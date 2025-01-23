// Worker



// Import mesh creator
importScripts("windMesh.js", "windData.js", "dartThrowing.js", "mitchellBestCand.js", "randomPoints.js", "beccario/decoder.js", "workerUtilities.js", "js/gl-matrix.js");

var mywinds = [];
var camera = [];
var isWorker = true;



onmessage = function(e) {

	//postMessage({"action": "checking!"});

	// Start application
	if (e.data["action"] == "init"){
		self.camera = e.data["camera"];
		self.camera.position = camera._position;
		self.camera.viewport = e.data["viewport"];


		mywinds = new windMesh( e.data["docURL"], postMessage({"action": "initOK"}));

	}

	// Change parameters
	else if (e.data["action"] == "reset"){
		self.camera = e.data["camera"];
		self.camera.position = camera._position;
		self.camera.viewport = e.data["viewport"];

		mywinds.init(e.data["Method"], e.data["Points"], e.data["Grid"], e.data["Grid Size"], e.data["Radii"], e.data["Mitchell candidates"]);

		postMessage({"ready": true});
	}

	// Update
	else if (e.data["action"] == "update"){
		
		self.camera = e.data["camera"];
		self.camera.position = camera._position;
		self.camera.viewport = e.data["viewport"];

		var value = 20;

		mywinds.update();

		sendArrays();

		postMessage({"ready": true});
	}

	// Update zoom out
	else if (e.data["action"] == "updateZoomOut"){
		self.camera = e.data["camera"];
		self.camera.position = camera._position;
		self.camera.viewport = e.data["viewport"];

		mywinds.updateZoomOut(e.data["percentage"]);

		sendArrays();

		postMessage({"ready": true});
	}

}


sendArrays = function(){

	
	if (mywinds.bufferArray){

		mywinds.bufferArray.set(mywinds.vertexArray, 0);
		mywinds.bufferArray.set(mywinds.normalArray, mywinds.vertexArray.length);

		mywinds.bufferArrayLines.set(mywinds.vertexArrayLines, 0);
		mywinds.bufferArrayLines.set(mywinds.normalArrayLines, mywinds.vertexArrayLines.length);

		postMessage({"mesh": "points", "array": mywinds.bufferArray});
		postMessage({"mesh": "lines", "array": mywinds.bufferArrayLines});
	}
	
}











