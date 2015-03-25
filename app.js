var cfenv = require('cfenv');

var appEnv = cfenv.getAppEnv();

var url = appEnv.getServiceURL('IBM Insights for Twitter-v5');

var request = require('request');

var analysed_tweets = [];

var last_tweet_date = new Date(null);

var sentiment = require('sentiment');				 

var watson = require('watson-developer-cloud');

var creds = appEnv.getServiceCreds('IBM Insights for Twitter-v5');

var Promise = require('promise');

var machine_translation = watson.machine_translation({
	  username: creds.username,
	  password: creds.password,
	  version: 'v1'
	});


var fire_search_request = function () {
	var cb = function (error, response, body) {
	  if (!error && response.statusCode == 200) {	    
	    extract_tweets(body);
	  }
	};

	request(construct_search_url(), cb);	
}

var get_last_tweet_date = function () {
	var parts = last_tweet_date.toISOString().split('.');
	return parts[0] + 'Z';
}

var construct_search_url = function () {
	var base_url = appEnv.getServiceURL('IBM Insights for Twitter-v5');
	var api = "api/v1/messages/search?q=qconsp AND posted:" + get_last_tweet_date();

	return base_url + api; 
}

var update_last_tweet_time = function (time) {
	var tweet_date = new Date(time);
	if (tweet_date > last_tweet_date) {
		console.log("Updating last tweet date...", tweet_date);
		last_tweet_date = tweet_date;
	}
}

var uses_english = function (tweet) {
	return tweet.message.twitter_lang === 'en'
}

var convert_to_english = function (tweet) {
	return new Promise(function (fulfill, reject) {
		console.log(4);
		machine_translation.translate({
		  text: tweet.message.body, from : 'ptbr', to: 'enus' },
		  function (err, response) {
		  	console.log(7);
		    if (err) {
		      reject(err);
		      return;
		    } 
			console.log(8);
			fulfill(response.translation);
		});
		console.log(123);
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

var extract_tweets = function (body) {
	var results = JSON.parse(body);
	Promise.all(results.tweets.map(analyse_tweet)).then(function (results) {
		console.log(results)
	}, function (err) { console.log(err) });
}

fire_search_request();