var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var plus = google.plus('v1');

var showdown  = require('showdown'),
    converter = new showdown.Converter();

var config = require('../config.json');

var url = 'mongodb://localhost:27017/deldotphi'; 

var oauth2Client = new OAuth2(config.oauth.clientID, config.oauth.secret, config.oauth.callback);

var scopes = [
  'https://www.googleapis.com/auth/plus.me',
  'https://www.googleapis.com/auth/userinfo.email'
];

var oauth_url = oauth2Client.generateAuthUrl({
  access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
  scope: scopes // If you only need one scope you can pass it as string
});

/* GET home page. */
router.get('/', function(req, res, next) {
	var res_data = {
		title: "Home",
		auth: req.cookies.auth
	};

	res.render('index.html', res_data);
});

router.get('/login', function(req, res, next){
	if(req.query.code){
		oauth2Client.getToken(req.query.code, function(err, tokens){
			if(!err){
				oauth2Client.setCredentials({
					access_token: tokens.access_token
				});

					plus.people.get({
						userId: 'me',
						auth: oauth2Client
					}, function(err, resp){
						if(!err){
							var email = resp.emails[0].value;

							MongoClient.connect(url, function(err, db){
								if(!err){
									db.collection('users').find({
										user: email
									}).toArray(function(err, data){
										if(data.length > 0 && data[0].user == email){
											res.cookie('auth', true);
											res.cookie('user', email);
											res.redirect(req.cookies.redirect);
										}else{
											res.render('error.html', {
												title: "Authentication Error",
												error: "",
												message: "Your email is not on the list. Talk to Sean about joining the closed beta."
											});
										}
									});
								}
							});
						}else{
							res.render('error.html', {
								title: "Authentication Error",
								error: err,
								message: "Something went wrong..."
							});
						}
				});
			}else{
				res.render('error.html', {
					title: "Authentication Error",
					error: err,
					message: "Something went wrong..."
				});
			}
		});
	}else if(req.cookies.auth == "true"){
		res.redirect('/');
	}else{
		res.redirect(oauth_url);	
	}
});

router.get('/logout', function(req, res, next){
	res.cookie('auth', false);
	res.cookie("redirect", '/');
	res.redirect('/');
});

router.get('/user/add', function(req, res, next){
	res.render('add_user.html', {title: "Redeem API Key"});
});

router.post('/user/add', function(req, res, next){
	if(
		req.body.email &&
		req.body.key
	){
		MongoClient.connect(url, function(err, db){
			if(!err){
				db.collection('keys').find({
					key: req.body.key
				}).toArray(function(err, data){
					if(!err){
						if(data[0].key == req.body.key){
							db.collection('users').insert({user: req.body.email});
							db.collection('keys').remove({key: req.body.key});
							res.send("OKKK!");
							db.close();
						}else{
							res.render('error.html',
								{
									title: "Authentication Error",
									message: "Bad API Key"
								}
							);
						}
					}
				});
			}
		});
	}else{
		res.render('error.html',
			{
				title: "Authentication Error",
				message: "Malformed API Request"
			}
		);
	}
});

router.get('/fetch/:name', function(req, res, next){
	find_entry({
		query: {
			name: req.params.name
		}
	}, function(err, data){
		if(!err){
			res.send(data);
		}else{
			res.send(err);
		}
	});
});

router.get('/view/:name', function(req, res, next){
	find_entry({
		query: {
			name: req.params.name
		}
	}, function(err, data){
		if(!err){
			data[0].title = req.params.name;			
			data[0].auth = req.cookies.auth;
			data[0].description = converter.makeHtml(data[0].description);

			res.render('view.html', data[0]);
		}else{
			res.send(err);
		}
	});
});

router.get('/edit/:name', isAuthed, function(req, res, next){
	find_entry({
		query: {
			name: req.params.name
		}
	}, function(err, data){
		if(!err){
			if(data.length > 0){
				data[0].title = req.params.name;
				data[0].auth = req.cookies.auth;
				data[0].user = req.cookies.user;

				res.render('edit.html', data[0]);
			}else{
				res.render('edit.html', {
					title: "New Entry",
					auth: req.cookies.auth,
					user: req.cookies.user,
					values: [
						{
							value: "",
							units: ""
						}
					]
				});
			}
		}else{
			res.send(err);
		}
	});
});

router.post('/edit', isAuthed, function(req, res, next){
	var data = req.body;

	MongoClient.connect(url, function(err, db){
		if(!err){
			data.date = new Date();
			data.tags = data.tags.split(",");
			db.collection('entries').insert(data, function(err, r){
				if(!err){					
					res.redirect('/view/' + data.name);
				}else{
					res.send(err);
				}
			});
		}else{
			res.send(err);
		}
	});
});

router.get('/search', function(req, res, next){
	find_entry({
		query: {
			//name: {$regex: req.query.q}
			$text: {
				$search: req.query.q
			}
		}
	}, function(err, data){
		if(!err){
			res.render('search.html', {
				title: "Search Results for " + req.query.q,
				auth: req.cookies.auth,
				query: req.query.q,
				results: data
			});
		}else{
			res.send(err);
		}
	});
});

router.get('/tags', function(req, res, next){
	get_tags(function(err, data){
		if(!err){
			res.send(data);
		}else{
			res.render('error.html', {
				title: "DB Error",
				error: err
			});
		}
	});
});

router.get('/tags/:tag', function(req, res, next){
	find_entry({
		query: {
			tags: {$in: [req.params.tag]}
		}
	}, function(err, data){
		if(!err){
			res.render('search.html', {
				title: "Tagged with " + req.params.tag,
				auth: req.cookies.auth,
				results: data
			});
		}else{
			res.send(err);
		}
	});
});


function find_entry(options, callback){
	MongoClient.connect(url, function(err, db) {
		if(!err){
			db.collection('entries').aggregate(
				[
					{
						$match: options.query
					},{
						$sort: {
							date: -1
						}
					},{
						$group: {
							_id: "$name",
							name: {$first: "$name"},
							symbol: {$first: "$symbol"},
							values: {$first: "$values"},
							description: {$first: "$description"},
							tags: {$first: "$tags"},
							user: {$first: "$user"},
							date: {$first: "$date"}
						}
					}
				]
			).toArray(function(err, data){
				if(!err){
					data = data.map(function(d){
						//console.log(d);
						d.tags = d.tags.join(",");						
						return d;
					});
					callback(null, data);
				}else{
					callback(err, null)
				}
			});
		}else{
			callback(err, null);
		}

  		db.close();
	});	
}

function isAuthed(req, res, next){
	console.log("Auth?");
	if(req.cookies.auth == "true"){
		next();
	}else{
		res.cookie("redirect", req.url);
		res.redirect("/login");
	}
}

function get_tags(callback){
	MongoClient.connect(url, function(err, db){
		if(!err){
			db.collection("entries").aggregate(
				[
					{
						$project: {
							name: "$name",
							tags: "$tags",
							date: "$date"
						}
					},{
						$sort: {
							date: -1
						}
					},{
						$group: {
							_id: "$name",
							tags: {$first: "$tags"}
						}
					},{
						$unwind: "$tags"
					},{
						$group: {
							_id: "$tags",
							tag: {$first: "$tags"},
							count: {$sum: 1}
						}
					},{
						$sort: {
							tag: 1
						}
					}
				]
			).toArray(function(err, data){
				if(!err){
					callback(null, data);
				}else{
					callback(err, null);
				}
			});
		}else{
			callback(err, null);
		}
	});
}

module.exports = router;
