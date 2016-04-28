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
    
    var url = "https://sizzling-inferno-5923.firebaseio.com";
    //var url="https://dev-preppo.firebaseio.com/teaching/21/whiteboard/";
    url = url + '/whiteboard/';
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


app.factory('whiteboardTeacherService', ['eventSenderService', 'helperService', function(eventSenderService, helperService) {
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
    
    var element = document.getElementById('cnvs1');
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
    var canvas = document.getElementById('cnvs1');
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


app.factory('whiteboardStudentService', ['firebaseSenderService', function(firebaseSenderService) {
    var canvas = document.getElementById('cnvs2');
    var context = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;
    context.clearRect(0, 0, context.canvas.width, context.canvas.height); // Clears the canvas
    context.fillStyle = '#00ff00';
    
    var element = document.getElementById('cnvs2');
    var position = element.getBoundingClientRect();
    
    var geoData = {
        x: position.left,
        y: position.top,
        height: 400,
        width: 600
    };
    
    var drawing = false;
    
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
    
    function clear() {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    
    var latestPoint = undefined;
    var timeoutEvent = undefined;
    
    var startHighlighting = function(e) {
        var x = e.pageX-geoData.x;
        var y = e.pageY-geoData.y;
        latestPoint = normalize([x, y]);
        drawing = true;
    }
    
    var continueHighlighting = function(e) {
        if(drawing) {
            var x = e.pageX-geoData.x;
            var y = e.pageY-geoData.y;
            latestPoint = normalize([x, y]);   
        }
    }
    
    var stopHighlighting = function(e) {
        drawing = false;
    }
    
    var drawPoint = function(point) {
        if(timeoutEvent) {
            clearTimeout(timeoutEvent);
        }
        clear();
        point = denormalize(point);
        //context.fillRect(point[0], point[1], 5, 5);
        context.beginPath();
        context.arc(point[0], point[1], 3, 0, 2 * Math.PI, false);
        context.fill();
        context.closePath();
        timeoutEvent = setTimeout( clear, 2000 );
    }
    
    var sendData = function() {
        console.log('latestPoint : ' + latestPoint);
        if(latestPoint) {
            console.log('inside latestPoint : ' + latestPoint);
            firebaseSenderService.pushEvent({n: 'pointer', v: latestPoint});
            latestPoint = undefined;
        }
    };
    
    return {
        clear: clear,
        drawPoint: drawPoint,
        sendData: sendData,
        startHighlighting: startHighlighting,
        continueHighlighting: continueHighlighting,
        stopHighlighting: stopHighlighting
    };
    
}])


app.factory('firebaseReceiverService', ['firebaseService', 'whiteboardTeacherService', 'whiteboardStudentService', '$rootScope', function(firebaseService, whiteboardTeacherService, whiteboardStudentService, $rootScope) {
    firebaseService['receiver'].on('child_added', function(snapshot) {
        var message = snapshot.val();
        var name = message.n;
        var value = message.v;
        
        if(name === 'stroke') {
            whiteboardTeacherService.showStroke(value); 
        }
        else if(name === 'tab-change') {
            value = parseInt(value);
            if(value == whiteboardTeacherService.userPreference.tabs) {
                whiteboardTeacherService.addTab();
            }
            else if(value < whiteboardTeacherService.userPreference.tabs) {
                whiteboardTeacherService.changeTab(value);
            }
        }
        else if(name === 'color-change') {
            whiteboardTeacherService.changeColor(value);
        }
        else if(name === 'width-change') {
            var thickness = whiteboardTeacherService.getPenWidth(parseInt(value));
            var index = whiteboardTeacherService.availableOptions.width.indexOf(thickness);
            if(index >= 0) {
                whiteboardTeacherService.changeWidth(index);
            }
        }
        else if(name === 'eraser-on') {
            var thickness = whiteboardTeacherService.getPenWidth(parseInt(value));
            whiteboardTeacherService.eraserOn(thickness);
        }
        else if(name === 'eraser-off') {
            whiteboardTeacherService.eraserOff();
        }
        else if(name === 'aspect-ratio') {
            
        }
        else if(name === 'pointer') {
            whiteboardStudentService.drawPoint(value);   
        }
        $rootScope.$apply();
    });
    
    return {};
}]);


app.controller('MainController', ['$scope', '$http', 'whiteboardTeacherService', 'whiteboardStudentService', 'firebaseSenderService', 'firebaseReceiverService', 'eventSenderService', 'helperService', function($scope, $http, whiteboardTeacherService, whiteboardStudentService, firebaseSenderService, firebaseReceiverService, eventSenderService, helperService) {
    
    //teacher
    $scope.whiteboardTeacherService = whiteboardTeacherService;
    function sendData() {
        var arr = eventSenderService.getEvents();
        eventSenderService.clearEvents();
        for(var i=0; i<arr.length; i++) {
            firebaseSenderService.pushEvent(arr[i]);
        }
    }
    
    function teacherTimerCalling() {
        whiteboardTeacherService.completeStroke(true);
        sendData();
    };
    
    $scope.newTabClicked = function() {
        whiteboardTeacherService.addTab();
        eventSenderService.addEvent('tab-change', whiteboardTeacherService.userPreference.selectedTab);
    };
    
    $scope.tabClicked = function(index) {
        if(index === whiteboardTeacherService.userPreference.selectedTab) {
            return;
        }
        whiteboardTeacherService.changeTab(index);
        eventSenderService.addEvent('tab-change', whiteboardTeacherService.userPreference.selectedTab);
    }; 
    
    $scope.colorClicked = function(index) {
        if(whiteboardTeacherService.availableOptions.color[index] === whiteboardTeacherService.userPreference.penColor) {
            return;
        }
        whiteboardTeacherService.changeColor(whiteboardTeacherService.availableOptions.color[index]);
        eventSenderService.addEvent('color-change', whiteboardTeacherService.userPreference.penColor);
    };
    
    $scope.eraserSelected = function(isEraserSelected) {
        if(whiteboardTeacherService.userPreference.isEraserSelected !== isEraserSelected) {
            if(isEraserSelected) {
                whiteboardTeacherService.eraserOn();
                eventSenderService.addEvent('eraser-on', 200);
            }
            else {
                whiteboardTeacherService.eraserOff();
                eventSenderService.addEvent('eraser-off');
            }
        }
    };
    
    $scope.penChanged = function(type) {
        if(type === 'pen') {
            if(whiteboardTeacherService.userPreference.isEraserSelected) {
                whiteboardTeacherService.userPreference.isEraserSelected = false;
                
            }
        }
        else if(type === 'eraser') {
            if(!whiteboardTeacherService.userPreference.isEraserSelected) {
                whiteboardTeacherService.userPreference.isEraserSelected = true;
            }
        } 
    }
    
    $scope.widthClicked = function(index) {
        if(whiteboardTeacherService.availableOptions.width[index] === whiteboardTeacherService.userPreference.penWidth) {
            return;
        }
        whiteboardTeacherService.changeWidth(index);
        eventSenderService.addEvent('width-change', whiteboardTeacherService.getPenWidth(whiteboardTeacherService.userPreference.penWidth));
    };
    
    
    //student
    $scope.whiteboardStudentService = whiteboardStudentService;
    function studentTimerCalling() {
        whiteboardStudentService.sendData();
    }
    
    //both
    if(helperService.user === 'teacher') {
        setInterval(function(){ teacherTimerCalling() }, 400);
    }
    else {
        setInterval(function(){ studentTimerCalling() }, 200);
    }

}]);