

// GUI
var gui = new dat.GUI();

var guiOpt = {"Points": 2000, "Method": "mitchell", "Worker": true, "Grid": true, "Grid Size": 100, "Radii": 4, "Mitchell candidates": 10,
 "Wind Lines": true, "Wind Points": true, "Activate Worker": true, "Worker": false};

guiOpt["Init"] = function(){
	if (!isWorker)
		mywinds.init(guiOpt["Method"], guiOpt["Points"], guiOpt["Grid"], guiOpt["Grid Size"], guiOpt["Radii"]/100, guiOpt["Mitchell candidates"]);
	else{
		myWorker.postMessage({"action": "reset", "Method": guiOpt["Method"], "Points": guiOpt["Points"],
		 "Grid": guiOpt["Grid"], "Grid Size": guiOpt["Grid Size"], "Radii": guiOpt["Radii"]/100, 
		 "Mitchell candidates": guiOpt["Mitchell candidates"], "camera": camera, "viewport": gl.viewport_data});
	}
}

guiOpt["Wind Lines"] = function(){
	windLines.flags.visible = !windLines.flags.visible;
}

guiOpt["Wind Points"] = function(){
	windPoints.flags.visible = !windPoints.flags.visible;
}

guiOpt["Activate Worker"] = function(){
	
	isWorker = !isWorker;
	guiOpt["Worker"] = isWorker;

	if (isWorker)
		console.log("Using worker");
	else
		console.log("Not using worker");

	myWorker.postMessage({"action": "reset", "Method": guiOpt["Method"], "Points": guiOpt["Points"],
		 "Grid": guiOpt["Grid"], "Grid Size": guiOpt["Grid Size"], "Radii": guiOpt["Radii"]/100, 
		 "Mitchell candidates": guiOpt["Mitchell candidates"], "camera": camera, "viewport": gl.viewport_data});
	
}

callworker = function(){
	
}


gui.add(guiOpt, "Points", 1, 15000).step(1);
gui.add(guiOpt, "Method", ["dart", "mitchell", "random"]);
gui.add(guiOpt, "Grid", true, false);
gui.add(guiOpt, "Grid Size", 2, 500).step(1);
gui.add(guiOpt, "Radii", 0.1, 10);
gui.add(guiOpt, "Mitchell candidates", 1, 50).step(1);
gui.add(guiOpt, "Wind Lines");
gui.add(guiOpt, "Wind Points");
gui.add(guiOpt, "Activate Worker");
gui.add(guiOpt, "Worker", true, false).listen();

gui.add(guiOpt, "Init");