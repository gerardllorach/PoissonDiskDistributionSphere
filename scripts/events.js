// EVENTS
gl.captureMouse(true);
gl.onmousemove = function (e)
{

	if (e.dragging)
	{
		if (camPosLatLong[0] + e.deltay * 0.1 < 90 && camPosLatLong[0] + e.deltay * 0.1 > -90)
			camPosLatLong[0] += e.deltay * 0.1;
		camPosLatLong[1] -= e.deltax * 0.05;
		vec3.polarToCartesian(camPos, [camPosLatLong[2], camPosLatLong[0] * DEG2RAD, (camPosLatLong[1] -90) * DEG2RAD]);
		camera.position = camPos;

		//mywinds.update();
	}
}


gl.onmousewheel = function (e)
{

	if (camPosLatLong[2] - e.wheel * 0.001 > 1.05){
		camPosLatLong[2] -= e.wheel*0.001;
		vec3.polarToCartesian(camPos, [camPosLatLong[2], camPosLatLong[0] * DEG2RAD, (camPosLatLong[1] -90) * DEG2RAD]);
		camera.position = camPos;
	}

	if (!mywinds.working && e.wheel < 0){

		if (!isWorker)
			mywinds.updateZoomOut(30);
		else {
			myWorker.postMessage({"action": "updateZoomOut", "camera": camera, "viewport": gl.viewport_data, "percentage": 30});
			myWorker.isReady = false;
		}
	}
}

context.captureKeys(true);

gl.onkeydown = function(e){
	if(e.character=="p"){
		loadShaders();
	}
	if (e.keyCode == 13){
		myWorker.postMessage({"action": "init", "docURL": document.URL, "camera": camera, "viewport": gl.viewport_data});
	}
	if (e.keyCode == 85){
		myWorker.postMessage({"action": "update", "camera": camera, "viewport": gl.viewport_data});
	}

	
}

window.onresize = function (e){
	context.canvas.width = window.innerWidth;
	context.canvas.height = window.innerHeight;

	camera.aspect =  gl.canvas.width / gl.canvas.height;

	gl.viewport(0,0,context.canvas.width,context.canvas.height);

};






// WORKER
if (!!window.Worker){

	myWorker.onmessage = function (e){
		

		//console.log("Received data is: ", e.data);

		// Mesh
		if (e.data["mesh"] && isWorker){

			// Could be "points" or "lines"
			var mesh_name = "wind_"+e.data["mesh"];

			var bufferArray = e.data["array"];
			var vertexArray = bufferArray.subarray(0,bufferArray.length/2);
			var normalArray = bufferArray.subarray(bufferArray.length/2, bufferArray.length);

			// Mesh has not been created
			if (!renderer.meshes[mesh_name]){
				renderer.meshes[mesh_name] = GL.Mesh.load({vertices: vertexArray, normals: normalArray});
			}
			// Mesh has changed the number of points
			else if (renderer.meshes[mesh_name].getBuffer("vertices").data.length != vertexArray.length){
				renderer.meshes[mesh_name] = GL.Mesh.load({vertices: vertexArray, normals: normalArray});
			}
			// Update. If mesh contains more information it would be better to upload buffers separately
			else {
				var buffer = renderer.meshes[mesh_name].getBuffer("vertices");
				buffer.data.set(vertexArray);
				//buffer.upload(gl.DYNAMIC_DRAW);
				
				buffer = renderer.meshes[mesh_name].getBuffer("normals");
				buffer.data.set(normalArray);
				//buffer.upload(gl.DYNAMIC_DRAW);

				renderer.meshes[mesh_name].upload(gl.DYNAMIC_DRAW);
			}

		}

		
		if (isWorker && e.data["ready"]){
		// 	setTimeout(shoot, 50);
			myWorker.isReady = true;
			
		}

	}
}

shoot = function(){
	myWorker.postMessage({"action": "update", "camera": camera, "viewport": gl.viewport_data});	
}