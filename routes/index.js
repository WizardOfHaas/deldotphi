var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient;
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var config = require('../config.json');

var url = 'mongodb://localhost:27017/deldotphi'; 

var oauth2Client = new OAuth2(config.oauth.clientID, config.oauth.secret, 'http://localhost:3000/login/');

var scopes = [
  'https://www.googleapis.com/auth/plus.me'
];

var oauth_url = oauth2Client.generateAuthUrl({
  access_type: 'offline', // 'online' (default) or 'offline' (gets refresh_token)
  scope: scopes // If you only need one scope you can pass it as string
});

/* GET home page. */
router.get('/', function(req, res, next) {
	find_entry({
		query: {
			name: {$regex: ""}
		}
	}, function(err, data){
		if(!err){
			res.render('index.html', {
				results: data,
				auth: req.cookies.auth
			});
		}else{
			res.send(err);
		}
	});
});

router.get('/login', function(req, res, next){
	if(req.query.code){
		res.cookie('auth', true);
		res.redirect(req.cookies.redirect);
	}else if(req.cookies.auth == "true"){
		res.redirect('/');
	}else{
		res.redirect(oauth_url);	
	}
});

router.get('/logout', function(req, res, next){
	res.cookie('auth', false);
	res.redirect('/');
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
				res.render('edit.html', data[0]);
			}else{
				res.render('edit.html', {
					title: "New Entry",
					auth: req.cookies.auth,
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
			name: {$regex: req.query.q}
		}
	}, function(err, data){
		if(!err){
			res.render('search.html', {
				title: "Search Results for " + req.query.q,
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
							user: {$first: "$user"}
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

module.exports = router;
