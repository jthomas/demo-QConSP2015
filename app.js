var cfenv = require('cfenv'),
    request = require('request'),
    sentiment = require('sentiment'),				 
    watson = require('watson-developer-cloud'),
    Promise = require('promise'),
	Twitter = require('twitter');

var appEnv = cfenv.getAppEnv();
var creds = appEnv.getServiceCreds('machine_translation');
var twitter_creds = appEnv.getServiceCreds('twitter');

var analysed_tweets = [];
var last_tweet_date = new Date(null);

var machine_translation = watson.machine_translation({
	username: creds.username,
	password: creds.password,
	version: 'v1'
});

var fire_search_request = function (cb) {
	request(construct_search_url(), function (error, response, body) {
	  if (!error && response.statusCode == 200) {	    
	    extract_tweets(body, cb);
	  }
	});	
}

var get_last_tweet_date = function () {
	var parts = last_tweet_date.toISOString().split('.');
	return parts[0] + 'Z';
}

var construct_search_url = function () {
	var base_url = appEnv.getServiceURL('twitter_insights');
	var api = "api/v1/messages/search?size=500&q=qconsp AND posted:" + get_last_tweet_date();

	return base_url + api; 
}

var update_last_tweet_time = function (time) {
	var tweet_date = new Date(time);
	if (tweet_date > last_tweet_date) {
		console.log("Updating last tweet date...", tweet_date);
		tweet_date.setSeconds(tweet_date.getSeconds() + 1);
		last_tweet_date = tweet_date;
	}
}

var uses_english = function (tweet) {
	return tweet.message.twitter_lang === 'en'
}

var convert_to_english = function (tweet) {
	return new Promise(function (fulfill, reject) {
		machine_translation.translate({
		  text: tweet.message.body, from : 'ptbr', to: 'enus' },
		  function (err, response) {
		    if (err) {
		      reject(err);
		      return;
		    } 
			fulfill(response.translation);
		});
	});
}

var analyse_sentiment = function (text) {
	var score = sentiment(text).score;

	if (score < 0) {
		return 'NEGATIVE' ;
	} else if (score > 0) {
		return 'POSITIVE';
	} 

	return 'NEUTRAL';	
}

var author_adddress = function (location) {
	return [location.city, location.state, location.country]
		.filter(function (i) {return !!i}).join(", ");	
}

var analyse_tweet = function (tweet) {
	return new Promise(function (fulfill, reject){
		var details = {};

		details.content = tweet.message.body;
		details.link = tweet.message.link;
		details.location = author_adddress(tweet.cde.author.location);		

		update_last_tweet_time(tweet.message.postedTime);

		if (uses_english(tweet)) {
			details.sentiment = tweet.cde.content.sentiment.polarity;
			fulfill(details);
			return;
		} 

		convert_to_english(tweet).then(function (translated) {
			details.sentiment = analyse_sentiment(translated);			
			fulfill(details);
		}, function (err) {
			reject(err)
		});
	});
}

var extract_tweets = function (body, cb) {
	var results = JSON.parse(body);
	console.log("Search resulted in " + results.tweets.length + " tweets");
	Promise.all(results.tweets.map(analyse_tweet)).then(cb, function (err) { console.log(err) });
}

var express = require('express')
var app = express()

app.use('/', express.static('public'));

app.get('/api/tweets', function (req, res) {
  fire_search_request(function (results) {  	
  	analysed_tweets = analysed_tweets.concat(results);
  	console.log("Returning " + analysed_tweets.length + " total tweets");
  	res.send(analysed_tweets);
  });  
})

app.get('/api/tweets/embed', function (req, res) {
  var link = req.query.link;
  console.log("Fetching embedded tweet for " + link);
	 
	var client = new Twitter({
	  consumer_key: twitter_creds.consumer_key,
	  consumer_secret: twitter_creds.consumer_secret,
	  access_token_key: twitter_creds.access_token_key,
	  access_token_secret: twitter_creds.access_token_secret
	});
	 
	var params = {url: link};
	client.get('/statuses/oembed.json', params, function(error, tweets, response){
	  if (!error) {
	    res.send(tweets);
	  }
	});

})

var server = app.listen(cfenv.getAppEnv().port, function () {
  var host = server.address().address
  var port = server.address().port

  console.log('Example app listening at http://%s:%s', host, port)
})