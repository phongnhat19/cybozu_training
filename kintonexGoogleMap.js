/* global google, kintone, firebase */
(function() {
  'use strict';

  // USER CUSTOM API KEY
  var GOOGLE_API_KEY = 'AIzaSyBnUFGbu9xqETENEGAKwVTVvx2Jd61lfi0';
  var FIREBASE_DB_NAME = 'cybozu-learnin-1539855411010';
  var FIREBASE_DOCUMENT_GROUP = 'shipperLocation';

  // ------------------
  var util = {
    loadJSScript: function(url, options) {
      return new kintone.Promise(function(resolve, reject) {
        var scriptElem = document.createElement('script');
        scriptElem.setAttribute('src', url);
        if (typeof options === 'object') {
          Object.keys(options).forEach(function(key) {
            scriptElem.setAttribute(key, options[key]);
          });
        }
        scriptElem.onload = function() {
          resolve(scriptElem);
        };
        scriptElem.onerror = function(error) {
          resolve(error);
        };
        document.head.appendChild(scriptElem);
      });
    }
  };

  // ------------------
  var GoogleMap = {
    key: '',
    GOOGLE_API_ENDPOINT: 'https://maps.googleapis.com/',
    API_STATUS_OK_TEXT: 'OK',
    directionsDisplay: null,
    directionsService: null,
    map: null,
    marker: null,
    shipperMarker: {},
    markerIcon: null,
    buildDistanceMaxtrixPath: function(data) {
      data.origin = encodeURI(data.origin);
      data.destination = encodeURI(data.destination);
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
    getLocationFromAddress: function(event) {
      var resultFromGoogleAPI;
      var address = event.record.store_address.value;
      var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURI(address) + '&key=' + GoogleMap.key;
      return kintone.proxy(url, 'GET', {}, {})
        .then(function(response) {
          if (response[1] === kintoneApp.HTTP_STATUS_SUCCESS) {
            resultFromGoogleAPI = JSON.parse(response[0]);
            event.record.location = resultFromGoogleAPI.results[0].geometry.location;
          }
          return event;
        })
        .catch(function(err) {
          event.error = err;
          return event;
        });
    },
    showShipperMarker: function(shipperID, shipperLocation) {
      if (GoogleMap.shipperMarker[shipperID]) {
        GoogleMap.shipperMarker[shipperID].setPosition(shipperLocation);
      } else {
        GoogleMap.shipperMarker[shipperID] = new google.maps.Marker({
          position: shipperLocation,
          map: GoogleMap.map,
          label: 'S' + shipperID
        });
      }
    },
    removeShipperMarker: function(shipperID) {
      if (GoogleMap.shipperMarker[shipperID]) {
        GoogleMap.shipperMarker[shipperID].setMap(null);
      }
    },
    showMarker: function(locationData) {
      if (GoogleMap.marker) {
        GoogleMap.marker.setPosition(locationData);
      } else {
        GoogleMap.marker = new google.maps.Marker({
          position: locationData,
          map: GoogleMap.map,
          label: 'S'
        });
      }
    },
    appendGoogleMapScriptTag: function() {
      return util.loadJSScript('https://maps.googleapis.com/maps/api/js?key=' + GoogleMap.key, {
        async: '',
        defer: ''
      })
        .then(function(scriptElem) {
          GoogleMap.directionsDisplay = new google.maps.DirectionsRenderer();
          GoogleMap.directionsService = new google.maps.DirectionsService();
          GoogleMap.markerIcon = {
            url: 'https://images.vexels.com/media/users/3/138300/isolated/lists/a4509596c30df0dbb4ff437948691fdb-transport-icon-bike.png',
            scaledSize: new google.maps.Size(25, 25),
            size: new google.maps.Size(71, 71)
          };
        })
        .catch(function(error) {
          
        });
    },
    buildMapOption: function(locationData) {
      return new kintone.Promise(function(resolve, reject) {
        resolve({
          zoom: 12,
          center: {lat: locationData.lat, lng: locationData.lng},
          mapTypeControl: true
        });
      });
    },
    updateMarker: function(recordID, snapshot, isMarker) {
      var location = null;
      if (snapshot) {
        location = snapshot.location;
      }
      if (isMarker) {
        GoogleMap.showMarker(location);
      } else if (snapshot.status === kintoneApp.STATUS_SHIPPING) {
        GoogleMap.showShipperMarker(recordID, location);
      } else {
        GoogleMap.removeShipperMarker(recordID);
      }
    },
    getBrowserLocation: function(defaultLocation) {
      return new kintone.Promise(function(resolve, reject) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(position) {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          });
        } else {
          resolve(defaultLocation);
        }
      });
    },
    init: function(apiKey) {
      GoogleMap.key = apiKey;
      return GoogleMap.appendGoogleMapScriptTag();
    }
  };

  // ------------------
  var GoogleFirebase = {
    key: '',
    databaseName: '',
    databaseURL: '',
    documentGroup: '',
    API_STATUS_OK_TEXT: 'OK',
    appendFirebaseDatabaseScriptTab: function() {
      return util.loadJSScript('https://www.gstatic.com/firebasejs/5.5.6/firebase-database.js',{})
        .then(function(scriptElem) {
          var config = {
            apiKey: GoogleFirebase.key,
            databaseURL: GoogleFirebase.databaseURL,
          };
          firebase.initializeApp(config);  
        });
    },
    appendFirebaseScriptTag: function() {
      return util.loadJSScript('https://www.gstatic.com/firebasejs/5.5.6/firebase-app.js', {})
        .then(GoogleFirebase.appendFirebaseDatabaseScriptTab);
    },
    listenForOrderDocumentChange: function(orderID, isMarker, updateMarker) {
      var recordURL = GoogleFirebase.documentGroup + '/' + orderID;
      var dbRef = firebase.database().ref(recordURL);
      dbRef.on('value', function(snapshot) {
        updateMarker(orderID, snapshot.val(), isMarker);
      });
    },
    setLocation: function(event) {
      var orderID = event.record.$id.value;
      var locationData = Object.assign({}, event.record.location);
      var recordURL = GoogleFirebase.documentGroup + '/' + orderID;
      delete event.record.location;
      return firebase.database().ref(recordURL).set({
        location: locationData,
        status: kintoneApp.STATUS_PENDING
      }).then(function(res) {
        return event;
      }).catch(function(err) {
        event.error = err;
        return event;
      });
    },
    init: function(apiKey, databaseName, documentGroup) {
      GoogleFirebase.key = apiKey;
      GoogleFirebase.databaseName = databaseName;
      GoogleFirebase.databaseURL = 'https://' + databaseName + '.firebaseio.com';
      GoogleFirebase.documentGroup = documentGroup;
      return GoogleFirebase.appendFirebaseScriptTag();
    }
  };

  // ------------------
  var kintoneApp = {
    SHOW_EVENT_LIST: [
      'app.record.detail.show'
    ],
    SHOW_SHIPPER_MAP_EVENT_LIST: [
      'app.record.index.show'
    ],
    SUBMIT_EVENT_LIST: [
      'app.record.create.submit',
      'app.record.edit.submit'
    ],
    SUBMIT_SUCCESS_EVENT_LIST: [
      'app.record.create.submit.success'
    ],
    SHIPPER_MAP_ID: 'shipper-map',
    BLANK_SPACE_FOR_MAP_DETAIL_VIEW: 'map',
    HTTP_STATUS_SUCCESS: 200,
    TRAVEL_MODE: 'DRIVING',
    DEFAULT_SHIPPING_PRICE: 0,
    DEFAULT_LAT: 10.776530,
    DEFAULT_LNG: 106.700981,
    STATUS_SHIPPING: 'Shipping',
    STATUS_PENDING: 'Pending',
    getRouteOptions: function(record) {
      return {
        origin: record.store_address.value,
        destination: record.address.value,
        travelMode: kintoneApp.TRAVEL_MODE
      };
    },
    fetchRecords: function(appId, opt_offset, opt_limit, opt_records) {
      var offset = opt_offset || 0;
      var limit = opt_limit || 100;
      var allRecords = opt_records || [];
      var params = {app: appId, query: 'limit ' + limit + ' offset ' + offset};
      return kintone.api('/k/v1/records', 'GET', params).then(function(resp) {
        allRecords = allRecords.concat(resp.records);
        if (resp.records.length === limit) {
          return kintoneApp.fetchRecords(appId, offset + limit, limit, allRecords);
        }
        return allRecords;
      });
    },
    listenForLocationFromFirebase: function(recordID, isMarker) {
      GoogleFirebase.listenForOrderDocumentChange(recordID, isMarker, GoogleMap.updateMarker);
    },
    handleShowShipperMap: function(event) {
      var defaultLocation = {lat: kintoneApp.DEFAULT_LAT, lng: kintoneApp.DEFAULT_LAT};
      var isMarker = false;
      var mapContainer;
      GoogleMap.getBrowserLocation(defaultLocation)
        .then(GoogleMap.buildMapOption)
        .then(function(mapOptions) {
          mapContainer = document.getElementById(kintoneApp.SHIPPER_MAP_ID);
          GoogleMap.renderMap(mapContainer, mapOptions);
        })
        .then(function() {
          return kintoneApp.fetchRecords(kintone.app.getId());
        })
        .then(function(records) {
          records.forEach(function(record) {
            kintoneApp.listenForLocationFromFirebase(record.$id.value, isMarker);
          });
        })
        .catch(function(error) {
          event.error = error;
          return event;
        });
    },
    handleShowEvent: function(event) {
      var record = event.record;
      var blankSpaceForMap = kintone.app.record.getSpaceElement(kintoneApp.BLANK_SPACE_FOR_MAP_DETAIL_VIEW);
      var mapOptions = {
        zoom: 14
      };
      var isMarker = true;
      var routeOptions = kintoneApp.getRouteOptions(record);
      GoogleMap.renderMap(blankSpaceForMap, mapOptions);
      GoogleMap.drawRoute(routeOptions);
      kintoneApp.listenForLocationFromFirebase(kintone.app.record.getId(), isMarker);
    },
    getLocationData: function(record) {
      return {
        origin: record.store_address.value,
        destination: record.address.value
      };
    },
    calculatePriceFromDistance: function(resultFromGoogleAPI, event) {
      var shippingPrice = parseInt(event.record.store_shipping_price.value, 10);
      if (resultFromGoogleAPI.status === 'OK') {
        event.record.price.value = (resultFromGoogleAPI.rows[0].elements[0].distance.value / 1000) * shippingPrice;
      } else {
        event.record.price.value = 0;
      }
      event.record.price.value = Math.ceil((event.record.price.value) / 1000) * 1000;
      return event;
    },
    calculatePrice: function(event, locationData) {
      var resultFromGoogleAPI;
      return kintone.proxy(GoogleMap.buildGoogleMapURL(locationData), 'GET', {}, {})
        .then(function(response) {
          if (response[1] === kintoneApp.HTTP_STATUS_SUCCESS) {
            resultFromGoogleAPI = JSON.parse(response[0]);
            return kintoneApp.calculatePriceFromDistance(resultFromGoogleAPI, event);
          }
          return event;
        })
        .catch(function(err) {
          event.error = err;
          return event;
        });
    },
    handleSubmitSuccessEvent: function(event) {
      return GoogleMap.getLocationFromAddress(event)
        .then(GoogleFirebase.setLocation)
        .catch(function(err) {
          event.error = err;
          return event;
        });
    },
    handleSubmitEvent: function(event) {
      var record = event.record;
      var locationData = kintoneApp.getLocationData(record);
      return kintoneApp.calculatePrice(event, locationData);
    },
    init: function() {
      GoogleFirebase.init(GOOGLE_API_KEY, FIREBASE_DB_NAME, FIREBASE_DOCUMENT_GROUP);
      GoogleMap.init(GOOGLE_API_KEY)
        .then(function() {
          kintone.events.on(kintoneApp.SHOW_EVENT_LIST, kintoneApp.handleShowEvent);
          kintone.events.on(kintoneApp.SUBMIT_EVENT_LIST, kintoneApp.handleSubmitEvent);
          kintone.events.on(kintoneApp.SHOW_SHIPPER_MAP_EVENT_LIST, kintoneApp.handleShowShipperMap);
          kintone.events.on(kintoneApp.SUBMIT_SUCCESS_EVENT_LIST, kintoneApp.handleSubmitSuccessEvent);
        })
        .catch(function(error) {

        });
    }
  };

  // MAIN
  kintoneApp.init();
})();