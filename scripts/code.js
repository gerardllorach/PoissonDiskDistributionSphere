


// DRAW
gl.ondraw = function()
{
	stats.begin();

	gl.clearColor(0.0,0.0,0.0,1);
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );

	renderer.render(scene, camera);

	stats.end();
};

var time = 0;

// UPDATE
gl.onupdate = function(dt)
{

	// Speed of wind drawing
	windLines.it += windLines.speed;
	windLines._uniforms = {u_it: windLines.it};


	if (!mywinds.working){

		time+=dt;
		if (!isWorker){
			if (time > 0.5){
				time = 0;
				mywinds.update();
			}
		} else if (myWorker.isReady){
			myWorker.postMessage({"action": "update", "camera": camera, "viewport": gl.viewport_data});
			myWorker.isReady = false;
		}

		//if (mywinds.indexofdispersion > 0.05)
		//	mywinds.updateZoomOut(10);
		
	}


};
