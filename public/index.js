var create_map = function () {
  var mapOptions = {
    center: { lat: -23.6076251, lng: -46.6972163},
    zoom: 3
  };
  
  window.map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  window.geocoder = new google.maps.Geocoder();
};

var load_tweets = function () {
  $.get('./api/tweets', function (results) {          
    $("#loading").hide();
    process_tweets(results);
  });
}

var create_marker = function (position, colour, link) {
  var marker = new google.maps.Marker({
    map: map,
    position: position,
    animation: google.maps.Animation.DROP,
    icon: 'http://www.googlemapsmarkers.com/v1/' + colour
  });

  google.maps.event.addListener(marker, 'click', function () { 
    show_tweet_details(marker, link); 
  });    
}

var show_tweet_details = function (marker, link) {
  $("#loading").show();
  $.get('./api/tweets/embed?link=' + link, function (results) {                      
    var infowindow = new google.maps.InfoWindow({
          content: results.html
      });
    infowindow.open(map, marker);
    $("#loading").hide();
  });
}

var process_tweets = function (results) {
  var item = results.pop();
  
  if (!item) return;
  if (item.location == "") process_tweets(results);

  geocoder.geocode( { 'address': item.location}, function(results, status) {
    if (status == google.maps.GeocoderStatus.OK) {    
        
        var colour = "00FF00";
        if (item.sentiment === "POSITIVE") {
          colour = "FF0000";
        } else if (item.sentiment === "NEGATIVE") {
          colour = "0000FF";
        } 
        
        create_marker(results[0].geometry.location, colour, item.link);        
      } else {
        console.log("Geocode was not successful for the following reason: " + status);
      }
    });
    // MAX API CALLS ONE PER SECOND
    setTimeout(function () { process_tweets(results) }, 1000);
}

var initialize = function() {
  create_map();
  load_tweets();
}

google.maps.event.addDomListener(window, 'load', initialize);