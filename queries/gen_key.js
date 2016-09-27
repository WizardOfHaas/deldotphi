var db = connect("localhost:27017/deldotphi");

var key = make_id(10);

db.keys.insert({
	key: key,
	date: new Date()
});

function make_id(l){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < l; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}