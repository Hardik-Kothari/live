var app = angular.module('whiteboardApp', []);

app.factory('helperService', [function() {
    var scripts = document.getElementsByTagName('script');
    var myScript = scripts[ scripts.length - 1 ];

    var queryString = myScript.src.replace(/^[^\?]+\??/,'');

    function parseQuery ( query ) {
        var Params = new Object ();
        if ( ! query ) return Params; // return empty object
        var Pairs = query.split(/[;&]/);
        for ( var i = 0; i < Pairs.length; i++ ) {
            var KeyVal = Pairs[i].split('=');
            if ( ! KeyVal || KeyVal.length != 2 ) continue;
            var key = unescape( KeyVal[0] );
            var val = unescape( KeyVal[1] );
            val = val.replace(/\+/g, ' ');
            Params[key] = val;
        }
        return Params;
    }
    
    var params = parseQuery( queryString );
    
    var user = params['user'];
    
    function lastOf(arr) {
        return arr[arr.length-1];
    }
    
    function getArray(num) {
        var arr = [];
        for(var i=0; i<num; i++) {
            arr.push(i);
        }
        return arr;
    }
    
    return {
        user: user,
        lastOf: lastOf,
        getArray: getArray
    };
    
}]);

app.factory('eventSenderService', [function() {
    var events = [];
     
    function addEvent(n, v) {
        var event = (v === undefined)?{ n: n}:{ n: n, v: v };
        events.push(event);
    }
    
    function clearEvents() {
        events = [];
    }
    
    function getEvents() {
        return events;
    }
    
    return {
        addEvent: addEvent,
        clearEvents: clearEvents,
        getEvents: getEvents
    };
}]);

app.factory('firebaseService', ['helperService', function(helperService) {
    
    var url = "https://sizzling-inferno-5923.firebaseio.com/test/";
    //var url="https://dev-preppo.firebaseio.com/teaching/21/whiteboard/";
    var senderUrl = url + helperService.user;
    
    function opposite(user) {
        if(user === 'student') {
            return 'teacher';
        }
        else if(user === 'teacher') {
            return 'student';
        }
    }
    
    var receiverUrl = url + opposite(helperService.user);
    
    return {
        sender: new Firebase(senderUrl),
        receiver: new Firebase(receiverUrl)
    };
    
}]);

app.factory('firebaseSenderService', ['firebaseService', function(firebaseService) {
    function pushEvent(event) {
        firebaseService['sender'].push(event);
    }
            
    return {
        pushEvent: pushEvent
    };
    
}]);


app.factory('whiteboardService', ['eventSenderService', 'helperService', function(eventSenderService, helperService) {
    var availableOptions = {
        width: ['thin', 'medium', 'thick'],
        color: ['#000000', '#0000ff', '#ff0000']
    };
    var userPreference = {
        penColor: availableOptions.color[0],
        penWidth: availableOptions.width[1],
        eraserColor: 'white',
        eraserWidth: 'defaultEraser',
        tabs: 1,
        selectedTab: 0,
        isEraserSelected: false
    };
    
    var element = document.getElementById('cnvs');
    var position = element.getBoundingClientRect();
    
    var geoData = {
        x: position.left,
        y: position.top-80,
        height: 400,
        width: 600
    };
    
    var strokes = [[]];
    var currentStroke = [];
    var last = undefined;
    var drawing = false;
    var canvas = document.getElementById('cnvs');
    var context = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
    context.strokeStyle = userPreference.penColor;
    context.lineWidth = denormalize(getPenWidth(userPreference.penWidth));
    context.lineJoin = "round";
    context.globalCompositeOperation="source-over";
    
    function normalize(point) {
        if(typeof(point) == 'object') {
            var x = Math.round(point[0]*10000/geoData.width);
            var y = Math.round(point[1]*10000/geoData.height);
            return [x, y];    
        }
        else {
            return Math.ceil(point*10000/geoData.width);   
        }
    }
    
    function denormalize(point) {
        if(typeof(point) == 'object') {
            var x = Math.round(point[0]*geoData.width/10000);
            var y = Math.round(point[1]*geoData.height/10000);
            return [x, y];    
        }
        else {
            return Math.ceil(point*geoData.width/10000);
        }
    }
    
    function getPenWidth(input) {
        if(typeof(input) == 'string') {
            var str = input;
            if(str === "thin") {
                return 20;
            }
            else if(str === "medium") {
                return 40;
            }
            else if(str === "thick") {
                return 60;
            }
            else if(str === "defaultEraser") {
                return 200;
            }
        }
        else if(typeof(input) == 'number') {
            var num = input;
            if(num === 20) {
                return 'thin';
            }
            else if(num === 40) {
                return 'medium';
            }
            else if(num === 60) {
                return 'thick';
            }
            else if(num === 200) {
                return 'defaultEraser';
            }
        }
    }
    
    function clear() {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    
    var completeStroke = function(isInterrupted) {
        if(currentStroke.length>0) {
            if(last) {
                currentStroke.unshift(last);
            }
            last = isInterrupted?helperService.lastOf(currentStroke):undefined;
            var toBeSentArray = currentStroke.slice();
            eventSenderService.addEvent('stroke', toBeSentArray);
            currentStroke = [];
        }
    };
    
    var startStroke = function(e) {
        drawing = true;
        var x = e.pageX-geoData.x;
        var y = e.pageY-geoData.y;
        strokes[userPreference.selectedTab].push([userPreference.isEraserSelected?userPreference.eraserColor:userPreference.penColor, userPreference.isEraserSelected?userPreference.eraserWidth:userPreference.penWidth, [normalize([x, y])]]);
        currentStroke = [normalize([x, y])];
        context.beginPath();
        context.moveTo(x, y);
    };
    
    var drawStroke = function(e) {
        if(drawing) {
            var x = e.pageX-geoData.x;
            var y = e.pageY-geoData.y;
            console.log("x, y : " + e.pageX + " , " + e.pageY);
            console.log("x, y : " + geoData.x + " , " + geoData.y);
            helperService.lastOf(helperService.lastOf(strokes[userPreference.selectedTab])).push(normalize([x, y]));
            currentStroke.push(normalize([x, y]));
            context.lineTo(x, y);
            context.stroke();
        }
    };
    
    var stopStroke = function() {
        context.closePath();
        drawing = false;
        completeStroke(false);
    };
    
    var redraw = function() {
        var strokesForThisTab = strokes[userPreference.selectedTab];
        for(var i=0; i<strokesForThisTab.length; i++) {
            var strokeInfo = strokesForThisTab[i];
            context.strokeStyle = strokeInfo[0];
            context.lineWidth = denormalize(getPenWidth(strokeInfo[1]));
            context.globalCompositeOperation = (strokeInfo[0] == 'white')?"destination-out":"source-over";
            var stroke = strokeInfo[2];
            context.beginPath();
            var a = denormalize(stroke[0]);
            context.moveTo(a[0], a[1]);
            for(var j=1; j<stroke.length; j++) {
                a = denormalize(stroke[j]);
                context.lineTo(a[0], a[1]);
            }
            context.stroke();
            context.closePath();
        }
        context.strokeStyle = userPreference.isEraserSelected?userPreference.eraserColor:userPreference.penColor;
        context.lineWidth = userPreference.isEraserSelected?userPreference.eraserWidth:userPreference.penWidth;
    };
    
    var showStroke = function(arr) {
        var a = denormalize(arr[0]);
        var x = a[0], y = a[1];
        context.beginPath();
        context.moveTo(x, y);
        strokes[userPreference.selectedTab].push([userPreference.isEraserSelected?userPreference.eraserColor:userPreference.penColor, userPreference.isEraserSelected?userPreference.eraserWidth:userPreference.penWidth, [arr[0]]]);
        for(var i=1; i<arr.length; i++) {
            a = denormalize(arr[i]);
            x = a[0];
            y = a[1];
            context.globalCompositeOperation = userPreference.isEraserSelected?"destination-out":"source-over";    
            context.lineTo(x, y);
            helperService.lastOf(helperService.lastOf(strokes[userPreference.selectedTab])).push(arr[i]);
        }
        context.stroke();
        context.closePath();
    };
    
    var addTab = function() {
        userPreference.tabs++;
        strokes.push([]);
        userPreference.selectedTab = userPreference.tabs-1;
        clear();
    };
    
    var changeTab = function(index) {
        userPreference.selectedTab = index;
        clear();
        redraw();
    }; 
    
    var changeColor = function(color) {
        userPreference.penColor = color;
        context.strokeStyle = userPreference.penColor;
    };
    
    var changeWidth = function(index) {
        userPreference.penWidth = availableOptions.width[index];
        context.lineWidth = denormalize(getPenWidth(userPreference.penWidth));
    };
    
    var eraserOn = function(width) {
        if(width) {
            userPreference.eraserWidth = width; 
        }
        context.strokeStyle = userPreference.eraserColor;
        context.lineWidth = denormalize(getPenWidth(userPreference.eraserWidth));
        context.globalCompositeOperation="destination-out";
        userPreference.isEraserSelected = true;
    };
    
    var eraserOff = function() {
        context.strokeStyle = userPreference.penColor;
        context.lineWidth = denormalize(getPenWidth(userPreference.penWidth));
        context.globalCompositeOperation="source-over";
        userPreference.isEraserSelected = false;
    };
    
    return {
        availableOptions: availableOptions,
        userPreference: userPreference,
        geoData: geoData,
        startStroke: startStroke,
        drawStroke: drawStroke,
        stopStroke: stopStroke,
        completeStroke: completeStroke,
        showStroke: showStroke,
        addTab: addTab,
        changeTab: changeTab,
        changeColor: changeColor,
        changeWidth: changeWidth,
        getArray: helperService.getArray,
        getPenWidth: getPenWidth,
        eraserOn: eraserOn,
        eraserOff: eraserOff
    };
    
}]);


app.factory('firebaseReceiverService', ['firebaseService', 'whiteboardService', '$rootScope', function(firebaseService, whiteboardService, $rootScope) {
    firebaseService['receiver'].on('child_added', function(snapshot) {
        var message = snapshot.val();
        var name = message.n;
        var value = message.v;
        
        if(name === 'stroke') {
            whiteboardService.showStroke(value); 
        }
        else if(name === 'tab-change') {
            value = parseInt(value);
            if(value == whiteboardService.userPreference.tabs) {
                whiteboardService.addTab();
            }
            else if(value < whiteboardService.userPreference.tabs) {
                whiteboardService.changeTab(value);
            }
        }
        else if(name === 'color-change') {
            whiteboardService.changeColor(value);
        }
        else if(name === 'width-change') {
            var thickness = whiteboardService.getPenWidth(parseInt(value));
            var index = whiteboardService.availableOptions.width.indexOf(thickness);
            if(index >= 0) {
                whiteboardService.changeWidth(index);
            }
        }
        else if(name === 'eraser-on') {
            var thickness = whiteboardService.getPenWidth(parseInt(value));
            whiteboardService.eraserOn(thickness);
        }
        else if(name === 'eraser-off') {
            whiteboardService.eraserOff();
        }
        else if(name === 'aspect-ratio') {
            
        }
        $rootScope.$apply();
    });
    
    return {};
}]);


app.controller('MainController', ['$scope', '$http', 'whiteboardService', 'firebaseSenderService', 'firebaseReceiverService', 'eventSenderService', 'helperService', function($scope, $http, whiteboardService, firebaseSenderService, firebaseReceiverService, eventSenderService, helperService) {
    $scope.whiteboardService = whiteboardService;
    
    function sendData() {
        var arr = eventSenderService.getEvents();
        eventSenderService.clearEvents();
        for(var i=0; i<arr.length; i++) {
            firebaseSenderService.pushEvent(arr[i]);
        }
    }
    
    function timerCalling() {
        whiteboardService.completeStroke(true);
        sendData();
    };
    
    $scope.newTabClicked = function() {
        whiteboardService.addTab();
        eventSenderService.addEvent('tab-change', whiteboardService.userPreference.selectedTab);
    };
    
    $scope.tabClicked = function(index) {
        if(index === whiteboardService.userPreference.selectedTab) {
            return;
        }
        whiteboardService.changeTab(index);
        eventSenderService.addEvent('tab-change', whiteboardService.userPreference.selectedTab);
    }; 
    
    $scope.colorClicked = function(index) {
        if(whiteboardService.availableOptions.color[index] === whiteboardService.userPreference.penColor) {
            return;
        }
        whiteboardService.changeColor(whiteboardService.availableOptions.color[index]);
        eventSenderService.addEvent('color-change', whiteboardService.userPreference.penColor);
    };
    
    $scope.eraserSelected = function(isEraserSelected) {
        if(whiteboardService.userPreference.isEraserSelected !== isEraserSelected) {
            if(isEraserSelected) {
                whiteboardService.eraserOn();
                eventSenderService.addEvent('eraser-on', 200);
            }
            else {
                whiteboardService.eraserOff();
                eventSenderService.addEvent('eraser-off');
            }
        }
    };
    
    $scope.penChanged = function(type) {
        if(type === 'pen') {
            if(whiteboardService.userPreference.isEraserSelected) {
                whiteboardService.userPreference.isEraserSelected = false;
                
            }
        }
        else if(type === 'eraser') {
            if(!whiteboardService.userPreference.isEraserSelected) {
                whiteboardService.userPreference.isEraserSelected = true;
            }
        } 
    }
    
    $scope.widthClicked = function(index) {
        if(whiteboardService.availableOptions.width[index] === whiteboardService.userPreference.penWidth) {
            return;
        }
        whiteboardService.changeWidth(index);
        eventSenderService.addEvent('width-change', whiteboardService.getPenWidth(whiteboardService.userPreference.penWidth));
    };
    
    if(helperService.user === 'teacher') {
        setInterval(function(){ timerCalling() }, 400);   
    }

}]);