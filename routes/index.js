var express = require('express');
var router = express.Router();
var MongoClient = require('mongodb').MongoClient

var url = 'mongodb://localhost:27017/deldotphi';

/* GET home page. */
router.get('/', function(req, res, next) {
	find_entry({
		query: {
			name: ""
		}
	}, function(err, data){
		if(!err){
			res.render('index.html', {
				results: data
			});
		}else{
			res.send(err);
		}
	});
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
			res.render('view.html', data[0]);
		}else{
			res.send(err);
		}
	});
});

router.get('/edit/:name', function(req, res, next){
	find_entry({
		query: {
			name: req.params.name
		}
	}, function(err, data){
		if(!err){
			if(data.length > 0){
				data[0].title = req.params.name;			
				res.render('edit.html', data[0]);
			}else{
				res.render('edit.html', {
					title: "New Entry",
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

router.post('/edit', function(req, res, next){
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
			name: req.query.q
		}
	}, function(err, data){
		if(!err){
			res.render('search.html', {
				title: "Search Results for " + req.query.q,
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
						$match: {
							name: {
								$regex: options.query.name
							}
						}
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

module.exports = router;
