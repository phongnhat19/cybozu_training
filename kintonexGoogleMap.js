(function(){
    "use strict";

    const GOOGLE_API_KEY = 'AIzaSyBnUFGbu9xqETENEGAKwVTVvx2Jd61lfi0';

    /**
     * Format Address
     * @param {String} address 
     * @return {String} formatedAddress
     */
    const formatAddress = function (address){
        return address.replace(/ /g,'+');
    }

    const buildGoogleMapURL = function(data){
        const GOOGLE_API_ENDPOINT = 'https://maps.googleapis.com/';
        const GOOGLE_DISTANCE_MATRIX_PATH = `maps/api/distancematrix/json?origins=${data.origin || ""}&destinations=${data.destination||""}&key=${GOOGLE_API_KEY}`;
        var url = `${GOOGLE_API_ENDPOINT}${GOOGLE_DISTANCE_MATRIX_PATH}`;
        return url;
    }

    /**
     * Calculate shipping price
     */
    const calculatePrice = function() {
        var eventList = [
            'app.record.create.submit',
            'app.record.edit.submit'
        ]
        kintone.events.on(eventList,function(event) {
            var record = event.record;
            if (record.store_address.value && record.store_address.value!=="" && record.address.value && record.address.value!=="") {
                var record = event.record;
                var shippingPrice = 0
                try {
                    shippingPrice = parseInt(record.store_shipping_price.value,10);
                } catch (error) {
                    console.log(error);
                }
                
                var shippingAddress = formatAddress(record.address.value);
                var originAddress = formatAddress(record.store_address.value);

                const locationData = {
                    origin: originAddress,
                    destination: shippingAddress
                }
                return kintone.proxy(buildGoogleMapURL(locationData),'GET',{},{})
                .then(function(response){
                    if (response[1]===200) {
                        var result = JSON.parse(response[0]);
                        if (result.status==="OK") {
                            event.record.price.value = (result.rows[0].elements[0].distance.value /1000)*shippingPrice;
                        }
                        else {
                            event.record.price.value = 0;
                        }
                        event.record.price.value = Math.ceil((event.record.price.value)/1000)*1000;
                        return event;
                    }
                    else {
                        return event;
                    }
                })
                .catch(function(err){
                    console.log(err)
                    return event;
                })
            }
            else {
                return event;
            }
        });
    }
    calculatePrice();

    /**
     * Render Map in detail view
     */
    const renderMapOnDetailView = function() {
        var eventList = [
            'app.record.detail.show',
            'mobile.app.record.detail.show'
        ]
        kintone.events.on(eventList,function(event){
            var record = event.record;

            var directionsService = new google.maps.DirectionsService();
            var directionsDisplay = new google.maps.DirectionsRenderer();
            const initMap = function() {
                var mapOptions = {
                    zoom:14
                }
                var map = new google.maps.Map(document.getElementById('user-js-map'), mapOptions);
                directionsDisplay.setMap(map);
            }

            const showDirection = function() {
                var routeOptions = {
                    origin: record.store_address.value,
                    destination: record.address.value,
                    travelMode: 'DRIVING'
                }
                directionsService.route(routeOptions, function(result, status){
                    if (status === 'OK') {
                        directionsDisplay.setDirections(result);
                    }
                });
            }

            initMap();
            showDirection();
        })
    }
    var scriptElem = document.createElement('script');
    scriptElem.setAttribute('src',`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}`);
    scriptElem.setAttribute('async','');
    scriptElem.setAttribute('defer','');
    scriptElem.onload = function(){
        renderMapOnDetailView();
    };
    document.head.appendChild(scriptElem);
})();