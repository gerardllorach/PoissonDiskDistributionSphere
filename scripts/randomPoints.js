


windMesh.prototype.randomPoints = function (){//(numPoints, points, vertexArray, normalArray){
	
	var candidate = vec3.create();

	for (var i = 0; i < this.numPoints; i++){

		windMesh.createCandidate(candidate, camera);

		this.points[i] = vec3.copy(vec3.create(), candidate);
		this.vertexArray.set(candidate, i*3);
		this.normalArray.set([1,1,1], i*3);
	}


}


windMesh.prototype.updateRandom = function (){

	this.working = true;

	var candidate = vec3.create();
	var points = this.points;
	var numPoints = this.numPoints;

	var outsideScreen = false;
	var behindSphere = false;


	for (var i = 0; i < numPoints; i++){

		// Outside the viewport
		var isOut = windMesh.isOutsideBounds (points[i], camera);

		if (isOut){
				
			// Create candidate
			windMesh.createCandidate(candidate, camera);

			points[i] = vec3.copy(vec3.create(), candidate);
				
			// Create wind path
			windMesh.createWindPath(candidate, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, i);

			this.vertexArray.set(candidate, i*3);

		}
	}

	if (!isWorker)
		this.assignBuffers();

	this.working = false;
}

windMesh.prototype.updateZoomOutRand = function(percentagePointsRelocate){

	var nPointsRelocate = Math.ceil(this.numPoints * percentagePointsRelocate / 100);

	var candidate = vec3.create();

	var points = this.points;

	for (var i = 0; i < nPointsRelocate; i++){

		var index = Math.floor(Math.random()*points.length);

		windMesh.createCandidate(candidate, camera);

		points[index] = vec3.copy(vec3.create(),candidate);

		// Create wind path
		windMesh.createWindPath(candidate, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, index);

		this.vertexArray.set(candidate, index*3);

	}

if (!isWorker)
	this.assignBuffers();
	

	this.working = false;
}