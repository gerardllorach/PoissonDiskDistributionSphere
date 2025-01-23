


windMesh.prototype.initDart = function(radLimit){



	// Subtitue functions that cannot be imported
	// windMesh.cameraProject(p,  camera._viewprojection_matrix, camera.viewport);
	self.camera.project = windMesh.cameraProject;


	this.radLimit = radLimit || 0.03; // 0.04 -> 2000

	this.emptyPoints = this.numPoints;

	// (numPoints, points, radLimit, vertexArray, normalArray)
	this.mesh = this.createPoissonDiskDartThrowing(this.numPoints, this.points, this.radLimit, this.vertexArray, this.normalArray);
	
}


// grab the point that has minimum radius and move it. when zooming out this
// might be a good solution. We could be grabbing one point at each iteration,
// how many iterations? Depending on the amount of zoom out, more will be needed.
// Also relationship between maximum radius and minimum radius can be used?
// Change the location of more points simultaniously when zooming out, instead of one by one.


// TODO: change radLimit when zooming in or out.

// Create new points when earth rotates, zoom in, or not reachead maximum points.
windMesh.prototype.updateDart = function(){
	camera.project = windMesh.cameraProject;

	this.working = true;

	var candidate = vec3.create();

	var vArray = this.vertexArray;
	var nArray = this.normalArray;

	var points = this.points;
	var numPoints = this.numPoints;

	var gridAct = this.gridAct;

	this.grid = [];
	this.gridLimits(this.limits);
	this.emptyPoints = 0;

	var pointsToRelocate = [];


	// Go over all points and add them to grid. Also check if they need to be relocated
	for (var i = 0; i < numPoints; i++){


		var isOut = false;

		if (points[i]){

			// Outside the viewport
			isOut = windMesh.isOutsideBounds(points[i], camera);

			// Update grid
			if (gridAct && !isOut){
				var screenPos = camera.project(points[i], camera._viewprojection_matrix, camera.viewport);
				this.addToGrid(screenPos, i);
			} else {
				points[i] = undefined;
				pointsToRelocate.push(i);
				ind--;
			}
		} else
			pointsToRelocate.push(i);
	}
		

	for (var ind = 0; ind < pointsToRelocate.length; ind++) {

		var i = pointsToRelocate[ind];

		// Behind the sphere condition or outside viewport
		if (this.working && !points[i]){
			
			// Create candidate
			windMesh.createCandidate(candidate, camera);

			// Check if the dart is valid (candidate, points, numPoints, radLimit)
			var valid;
			if (gridAct){
				valid = this.validateDartWithGrid(candidate, points, numPoints, this.radLimit);
			} else {
				valid = windMesh.validateDart(candidate, points, numPoints, this.radLimit);
			}
			
		
			if (valid){
				points[i] = vec3.copy(vec3.create(), candidate);

				// Add to grid
				if (gridAct){
					var screenPos = camera.project(points[i], camera._viewprojection_matrix, camera.viewport);
					this.addToGrid(screenPos, i);
				}
			
				// Create wind path
				windMesh.createWindPath(candidate, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, i);

				vArray.set(candidate, i*3);
				nArray.set(this.color, i*3);

			} else {
				points[i] = undefined;
				this.emptyPoints++;

				vArray.set([0,0,0], i*3);
			}
		}
	}


	if (this.emptyPointsF() > this.numPoints/4){
		this.radLimit *= 0.8;
		console.log(this.radLimit);
	}



	// Relocate the point with smaller radius
	//this.updateZoomOut(1);

	//console.log("AVERAGE RADIUS: ", this.averageRadius, "MAX RADIUS: ", this.maxRadius, "MIN RADIUS: ", this.minRadius);

	// var buffer = this.mesh.getBuffer("vertices");
	// var bnormals = this.mesh.getBuffer("normals");
	// buffer.data.set(vArray);
	// bnormals.data.set(nArray);
	// buffer.upload(gl.STREAM_DRAW);

	if (!isWorker)
		this.assignBuffers();
	//  var buffers = { 
 //     	vertices: vArray,
 //     	normals:  nArray
 //     };
	// this.mesh = Mesh.load(buffers);
	// renderer.meshes["windP"] = this.mesh;

	// buffers = {
	// 	vertices: this.vertexArrayLines,
	// 	normals: this.normalArrayLines
	// };
	// this.meshLines = Mesh.load(buffers);
	// renderer.meshes["windL"] = this.meshLines;

	this.working = false;


}


windMesh.prototype.updateZoomOutDart = function (percentagePointsRelocate){
	if (this.radLimit < 0.1)
		this.radLimit *= 3;
	
	var nPointsRelocate = Math.ceil(this.numPoints * percentagePointsRelocate / 100);

	var points = this.points;

	var grid = this.grid;
	var gridSize = this.gridSize;
	var gridInfo = [];


	// Calculate the min distance inside each cell of the grid. We are not checking nearby cells for speed purposes. I could optimize the for; grid.length instead gridSize*gridSize (not much optimization though)
	for (var i = 0; i < gridSize*gridSize; i++){

		// Points inside each cell
		var pointsIniside = [];
		pointsInside = grid[i];
		

		var minRadius = null;

		if (pointsInside){

			// Distances between points
			for (var j = 0; j < pointsInside.length-1; j++){
				for (var k = j+1; k < pointsInside.length; k++){
					var ind1 = pointsInside[j];
					var ind2 = pointsInside[k];

					var radius;
					if (!points[ind1] || !points[ind2])
						radius = minRadius;
					else 
						radius = windMesh.distGreatArc(points[ind1], points[ind2]);


					if (!minRadius || radius < minRadius)
						minRadius = radius;
				}

			}
			// It can happen that there is only one point inside the grid. minRadius would be null then
			// Store the minimum radius inside each cell. Maybe I should store the average distance between points
			if (minRadius){
				gridInfo.push({"rad": minRadius, "cellId": i});
			}
			
		}
	}

	// Sort by minRad, smaller first
	gridInfo.sort(function(a,b){return a.rad-b.rad});

	// Instead of relocate, I should delete them, they will be relocated when updating! If we want to relocate here, the grid should be created
	// How do I choose which points to relocate?
	// Opt 1- Iterate over the first 30% cells and relocate 80% inside each?
	// Opt 2- Store indices from points inside selected cells until percentage is reached. Maybe only a couple of cells are relocated, looks ugly if only done once?

	var i = 0;
	var index = 0;
	while (i < nPointsRelocate){
		// Choose random points to be relocated
		if (!gridInfo[index]){
			var pInd = Math.floor(Math.random()*this.numPoints);
			points[pInd] = undefined;
			i++;		
		} 
		// Choose points that are inside cells with minimum radius
		else {
			// Cell id of grid with smaller radius
			var cellId = gridInfo[index].cellId;
			// Points inside the cell with smaller radius
			var pointsInside = grid[cellId];
			// Number of points to relocate from this cell. Cells with smaller radius should have higher densities.
			var doublePercentage = percentagePointsRelocate * 4 / 100 >= 1 ? 1 : percentagePointsRelocate * 4 / 100;
			var nPRelInside = Math.ceil(pointsInside.length * doublePercentage);

			for (var j = 0; j < nPRelInside; j++){
				var pInd = pointsInside[j];
				points[pInd] = undefined;
				i++;
			}
			// Move to the next cell
			index++;
		}
		
	}

}






windMesh.prototype.updateZoomOutDartOld = function(percentagePointsRelocate){

	this.radLimit *= 2;
	console.log(this.radLimit);

	this.working = true;

	var nPointsRelocate = Math.ceil(this.numPoints * percentagePointsRelocate / 100);

	var candidate = vec3.create();

	var points = this.points;
	var numPoints = this.numPoints;

	this.emptyPoints = 0;


	for (var i = 0; i < nPointsRelocate; i++){

		var index = Math.floor(Math.random()*points.length);

		windMesh.createCandidate(candidate, camera);

		var valid;
		// Check if the dart is valid tion(out, candidate, points, radLimit){
		if (this.gridAct)
			valid =  this.validateDartWithGrid(candidate, points, numPoints, this.radLimit);
		else
			valid = windMesh.validateDart(candidate, points, numPoints, this.radLimit);
	

		if (valid){
			points[index] = vec3.copy(vec3.create(), candidate);

			// Add to grid
			if (this.gridAct){
				var screenPos = camera.project(points[index], camera._viewprojection_matrix, camera.viewport);
				this.addToGrid(screenPos, index);
			}
		
			// Create wind path
			windMesh.createWindPath(candidate, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, index);

			this.vertexArray.set(candidate, index*3);
			this.normalArray.set(this.color, index*3);

		} else {
			points[index] = undefined;
			this.emptyPoints++;

			this.vertexArray.set([0,0,0], index*3);
		}


	}


	this.assignBuffers();

	this.working = false;
}









// Static points
windMesh.prototype.createPoissonDiskDartThrowing = function(numPoints, points, radLimit, vertexArray, normalArray){

	var candidate = vec3.create();
	
	var emptyPoints = numPoints;

	for (var i = 0; i < numPoints; i++){

			
		// Create candidate
		windMesh.createCandidate(candidate, camera);

		var valid;
		// Check if the dart is valid tion(out, candidate, points, radLimit){
		if (this.gridAct)
			valid =  this.validateDartWithGrid(candidate, points, numPoints, radLimit);
		else{
			valid = windMesh.validateDart(candidate, points, numPoints, radLimit);
		}
	
		// Nothing happens if vertexArray has empty cells in between?
		if (valid) {

			// Store the new point in the arrays. points and vertexArray contain the same information..
			points[i] = vec3.copy(vec3.create(), candidate);
			//this.validPoints.push(i);
			
			// Add to grid
			if (this.gridAct){
				var screenPos = camera.project(points[i], camera._viewprojection_matrix, camera.viewport);
				this.addToGrid(screenPos, i);
			}
			
			emptyPoints--;

			vertexArray.set(candidate, i*3);
			normalArray.set([1,1,1], i*3);
		}

    }

    console.log("Percentage of points not allocated: ", (emptyPoints/numPoints)*100);

}



windMesh.prototype.validateDartWithGrid = function (candidate, points, numPoints, radLimit){

	var screenPos = camera.project(candidate, camera._viewprojection_matrix, camera.viewport);

	var indPointsNearby = [];
	this.getNearbyIdPointsWithGrid(indPointsNearby, screenPos);

	var index;

	for (var i = 0; i < indPointsNearby.length; i++){

		index = indPointsNearby[i];

		if (points[index]){
			var radius = windMesh.distGreatArc(candidate, points[index]);
			if (radius<radLimit){
				return false;
			}
		} 
	}

	return true;

}



windMesh.validateDart = function(candidate, points, numPoints, radLimit){


	for (var i = 0; i < numPoints; i++){
		
		if (points[i]){
			var radius = windMesh.distGreatArc(candidate, points[i]);
			if (radius<radLimit){
				return false;
			}
		}
		
	}

	return true;
}


windMesh.prototype.emptyPointsF = function (){
	var j = 0;
	for (var i = 0; i < this.numPoints; i++){
		if (!this.points[i])
			j++;
	}
	
	return j;
}


