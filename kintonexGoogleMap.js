/* global google, kintone */
(function() {
  'use strict';

  var GOOGLE_API_KEY = 'AIzaSyBnUFGbu9xqETENEGAKwVTVvx2Jd61lfi0';

  // ------------------
  var GoogleMap = {
    key: '',
    GOOGLE_API_ENDPOINT: 'https://maps.googleapis.com/',
    API_STATUS_OK_TEXT: 'OK',
    directionsDisplay: null,
    directionsService: null,
    map: null,
    buildDistanceMaxtrixPath: function(data) {
      return 'maps/api/distancematrix/json?origins=' + data.origin + '&destinations=' + data.destination + '&key=' + GoogleMap.key;
    },
    buildGoogleMapURL: function(data) {
      var url = GoogleMap.GOOGLE_API_ENDPOINT + GoogleMap.buildDistanceMaxtrixPath(data);
      return url;
    },
    renderMap: function(container, mapOptions) {
      GoogleMap.map = new google.maps.Map(container, mapOptions);
      GoogleMap.directionsDisplay.setMap(GoogleMap.map);
    },
    drawRoute: function(routeOptions) {
      GoogleMap.directionsService.route(routeOptions, function(result, status) {
        if (status === GoogleMap.API_STATUS_OK_TEXT) {
          GoogleMap.directionsDisplay.setDirections(result);
        }
      });
    },
    init: function(apiKey) {
      var scriptElem = document.createElement('script');
      GoogleMap.key = apiKey;
      scriptElem.setAttribute('src', 'https://maps.googleapis.com/maps/api/js?key=' + GoogleMap.key);
      scriptElem.setAttribute('async', '');
      scriptElem.setAttribute('defer', '');
      scriptElem.onload = function() {
        GoogleMap.directionsDisplay = new google.maps.DirectionsRenderer();
        GoogleMap.directionsService = new google.maps.DirectionsService();
      };
      document.head.appendChild(scriptElem);
    }
  };

  // ------------------
  var handleKintoneEvent = {
    SHOW_EVENT_LIST: [
      'app.record.detail.show'
    ],
    SUBMIT_EVENT_LIST: [
      'app.record.create.submit',
      'app.record.edit.submit'
    ],
    HTTP_STATUS_SUCCESS: 200,
    TRAVEL_MODE: 'DRIVING',
    DEFAULT_SHIPPING_PRICE: 0,
    handleShowEvent: function(event) {
      var record = event.record;
      var blankSpaceForMap = kintone.app.record.getSpaceElement('map');
      var mapOptions = {
        zoom: 14
      };
      var routeOptions = {
        origin: record.store_address.value,
        destination: record.address.value,
        travelMode: handleKintoneEvent.TRAVEL_MODE
      };
      GoogleMap.renderMap(blankSpaceForMap, mapOptions);
      GoogleMap.drawRoute(routeOptions);
    },
    getLocationData: function(record) {
      var shippingAddress = encodeURI(record.address.value);
      var originAddress = encodeURI(record.store_address.value);
      return {
        origin: originAddress,
        destination: shippingAddress
      };
    },
    calculatePrice: function(event, locationData) {
      var resultFromGoogleAPI;
      var shippingPrice = handleKintoneEvent.DEFAULT_SHIPPING_PRICE;
      try {
        shippingPrice = parseInt(event.record.store_shipping_price.value, 10);
      } catch (error) {
        event.error = 'Price must be number';
      }
      return kintone.proxy(GoogleMap.buildGoogleMapURL(locationData), 'GET', {}, {})
        .then(function(response) {
          if (response[1] === handleKintoneEvent.HTTP_STATUS_SUCCESS) {
            resultFromGoogleAPI = JSON.parse(response[0]);
            if (resultFromGoogleAPI.status === 'OK') {
              event.record.price.value = (resultFromGoogleAPI.rows[0].elements[0].distance.value / 1000) * shippingPrice;
            } else {
              event.record.price.value = 0;
            }
            event.record.price.value = Math.ceil((event.record.price.value) / 1000) * 1000;
            return event;
          }
          return event;
        })
        .catch(function(err) {
          event.error = 'Something wrong with Google';
          return event;
        });
    },
    handleSubmitEvent: function(event) {
      var record = event.record;
      var locationData = handleKintoneEvent.getLocationData(record);
      return handleKintoneEvent.calculatePrice(event, locationData);
    },
    init: function() {
      GoogleMap.init(GOOGLE_API_KEY);
      kintone.events.on(handleKintoneEvent.SHOW_EVENT_LIST, handleKintoneEvent.handleShowEvent);
      kintone.events.on(handleKintoneEvent.SUBMIT_EVENT_LIST, handleKintoneEvent.handleSubmitEvent);
    }
  };

  // MAIN
  handleKintoneEvent.init();
})();