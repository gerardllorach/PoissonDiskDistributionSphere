

windMesh.prototype.initMitchell = function(numCandidates){

	this.radiusPoints = [];

	this.averageRadius = 0;
	this.indexofdispersion = 0;
	this.maxRadius = null;
	this.minRadius = null;


	this.numCandidates = numCandidates || 10;


	this.createPoissonDisk(this.numPoints, this.numCandidates, 
		this.points, this.radiusPoints, this.averageRadius,
		this.vertexArray, this.normalArray);

	for (var i = 0; i < this.numPoints; i++){
		var screenPos = windMesh.cameraProject(this.points[i],  camera._viewprojection_matrix, camera.viewport);
		this.addToGrid (screenPos, i);
	}

}


// Create new points when earth rotates or zoom in
windMesh.prototype.updateMitchell = function(){
	this.working = true;

	var candidate = vec3.create();
	var best = vec3.create();

	var vArray = this.vertexArray;
	var nArray = this.normalArray;

	var points = this.points;

	// Grid
	var gridAct = this.gridAct;
	this.grid = [];
	this.gridLimits(this.limits);
	var pointsToRelocate = [];

	// Worker util
	var viewport = camera.viewport;


	for (var i = 0; i < this.numPoints; i++){

		//var outsideScreen = false;
		//var behindSphere = false;
		var isOut = false;

		if (points[i]){

			isOut = windMesh.isOutsideBounds(points[i], camera);
		}


		// Behind the sphere condition or outside viewport
		if (this.working && !points[i] || isOut){
			

			// No Grid
			if (!gridAct){
				this.createNewPointMitchell(candidate, best, vArray, nArray, points, i);
			} 
			// Grid
			else {
				pointsToRelocate.push(i);
			}

		} 
		// Grid
		else if (gridAct){
			var screenPos = windMesh.cameraProject(points[i], camera._viewprojection_matrix, camera.viewport);
			this.addToGrid (screenPos, i);
		}

			

	}


	// Grid
	if (gridAct){

		for (var j = 0; j < pointsToRelocate.length; j++){
			var i = pointsToRelocate[j];
			this.createNewPointMitchell(candidate, best, vArray, nArray, points, i);
			var screenPos = windMesh.cameraProject(points[i], camera._viewprojection_matrix, camera.viewport);
			this.addToGrid (screenPos, i);
		}
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

	this.working = false;


}



windMesh.prototype.createNewPointMitchell = function(candidate, best, vArray, nArray, points, i){
	
	var bestRadius = null;
	
	for (var j = 0; j < this.numCandidates; j++){
		windMesh.createCandidate(candidate, camera, this.limits);

		if (candidate[0] != undefined){

			if (this.gridAct ){
				var screenPos = windMesh.cameraProject(candidate,  camera._viewprojection_matrix, camera.viewport);
				var indPoints = [];
				this.getNearbyIdPointsWithGrid (indPoints, screenPos);

				// Find best
				bestRadius = windMesh.findBest(best, candidate, points, bestRadius, indPoints);
			} else{
				bestRadius = windMesh.findBest(best, candidate, points, bestRadius);
			}
		}

	}


	points[i] = vec3.copy(vec3.create(),best);
	
	// Create wind path
	windMesh.createWindPath(best, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, i);


	vArray.set(best, i*3);
	nArray.set(this.color, i*3);
}



windMesh.prototype.updateZoomOutMitchell = function(percentagePointsRelocate){


	
	var nPointsRelocate = Math.ceil(this.numPoints * percentagePointsRelocate / 100);

	var points = this.points;

	var grid = this.grid;
	var gridSize = this.gridSize;
	var gridInfo = [];

	this.gridLimits(this.limits);


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
			this.vertexArray.set([0,0,0], pInd*3);
			i++;		
		} 
		// Choose points that are inside cells with minimum radius
		else {
			// Cell id of grid with smaller radius
			var cellId = gridInfo[index].cellId;
			// Points inside the cell with smaller radius
			var pointsInside = grid[cellId];
			// Number of points to relocate from this cell. Cells with smaller radius should have higher densities.
			var nPRelInside = Math.ceil(pointsInside.length * percentagePointsRelocate / 100);

			for (var j = 0; j < nPRelInside; j++){
				var pInd = pointsInside[j];
				points[pInd] = undefined;
				this.vertexArray.set([0,0,0], pInd*3);
				i++;
			}
			// Move to the next cell
			index++;
		}
		
	}

}




// grab the point that has minimum radius and move it. when zooming out this
// might be a good solution. We could be grabbing one point at each iteration,
// how many iterations? Depending on the amount of zoom out, more will be needed.
// Also relationship between maximum radius and minimum radius can be used?
// Change the location of more points simultaniously when zooming out, instead of one by one.



windMesh.prototype.updateZoomOutMitchellOld = function(percentagePointsRelocate){

	var nPointsRelocate = Math.ceil(this.numPoints * percentagePointsRelocate / 100);

	var candidate = vec3.create();
	var best = vec3.create();

	var points = this.points;

	var maxRadius = null;
	var minRadius = null;
	var averageRadius = 0;

	var minimalInd = [];

	// Find the point with smaller radius
	for (var i = 0; i < this.numPoints; i++){
		var min = null;
		
		// Finds the radius for each point
		// TODO: Could be optimized because distances are calculated twice (a->b, b->a)
		for (var j = 0; j < this.numPoints; j++){
			
			if ( i != j){
				//var radius = vec3.distance(points[i], points[j]);
				var radius = windMesh.distGreatArc(points[i], points[j]);

				if (!min || radius < min){
					min = radius;
				}
			}

		}


		this.radiusPoints[i] = min;


		// Min, Max, Average
		if (!maxRadius || maxRadius < this.radiusPoints[i]){
			maxRadius = this.radiusPoints[i];
		}

		if (!minRadius || minRadius > this.radiusPoints[i]){
			minRadius = this.radiusPoints[i];
		}


		// Store point ids with smaller radius
		if (minimalInd.length < nPointsRelocate){
			minimalInd.push({"rad": min, "id": i});
			minimalInd.sort(function(a,b){return b.rad-a.rad});
		} else if (min < minimalInd[0].rad){
			minimalInd.shift();
			minimalInd.push({"rad": min, "id": i});
			minimalInd.sort(function(a,b){return b.rad-a.rad});	
		}



		averageRadius+=this.radiusPoints[i];
	}

	averageRadius = averageRadius/this.numPoints;


	var variance = 0;
	for (var i = 0; i< this.numPoints; i++){
		var temp = (this.radiusPoints[i]-averageRadius);
		variance += temp*temp;
	}
	variance = variance / this.numPoints;


	// Index of dispersion
	this.indexofdispersion = variance/averageRadius;

	//console.log("IoD: ", this.indexofdispersion, "Var :", variance);
	console.log(this.indexofdispersion);


	// Relocate points with smaller radius. Sort by ids
	minimalInd.sort(function(a,b){return a.id-b.id});
	var index = 0;
	// Find a new candidate for the point with smaller radius
	for (var i = 0; i < this.numPoints; i++){

		var numMinInd = minimalInd.length;
		for (var j = index; j < numMinInd; j++){

			if (minimalInd[j].id == i){

				var bestRadius = null;
				for (var k = 0; k < this.numCandidates; k++){
					windMesh.createCandidate(candidate, camera);
					bestRadius = windMesh.findBest(best, candidate, points, bestRadius);
				}


				points[i] = vec3.copy(vec3.create(),best);
				this.radiusPoints[i] = bestRadius;

				// Create wind path
				windMesh.createWindPath(best, this.pathSize, this.step, this.wData, this.vertexArrayLines, this.normalArrayLines, i);

				this.vertexArray.set(best, i*3);

				// Exit loop and try if next point is minimal. Because a new point is added the loop has to start again
				index = j+1;
				j = numMinInd;

			} else if (minimalInd[j].id > i){
				index = j;
				j = numMinInd;
			}
		}

	}

	if (!isWorker)
		this.assignBuffers();

	this.working = false;
}









// Static points
windMesh.prototype.createPoissonDisk = function(numPoints, numCandidates, points, radiusPoints, averageRadius, vertexArray, normalArray){

	var candidate = vec3.create();
	var best = vec3.create();
	
	var ind = 0;
	

	for (var i = 0; i < numPoints; i++){

		var bestRadius = null;

		// Create k candidates, picking the best (farther apart).
		for (var j = 0; j < numCandidates; j++) {
			
			// Create candidate
			windMesh.createCandidate(candidate, camera, this.limits);

			// Find close points
			if (this.gridAct){
				var screenPos = windMesh.cameraProject(candidate,  camera._viewprojection_matrix, camera.viewport);

				if (!camera._viewprojection_matrix || camera.viewport[0]!=0)
					console.log("Error!: ", screenPos, camera.project(candidate));

				var indPoints = [];
				this.getNearbyIdPointsWithGrid (indPoints, screenPos);

				// Find best
				bestRadius = windMesh.findBest(best, candidate, points, bestRadius, indPoints);
			} else
				// Find best
				bestRadius = windMesh.findBest(best, candidate, points, bestRadius);

		}


		// Store the new point in the arrays. points and vertexArray contain the same information..
		points.push(vec3.copy(vec3.create(),best));
		radiusPoints.push(bestRadius);

		if (this.gridAct){
			var screenPos = windMesh.cameraProject(best,  camera._viewprojection_matrix, camera.viewport);
			this.addToGrid(screenPos, i);
		}

		// Create wind path?? Optimization


		vertexArray.set(best, ind);
		normalArray.set([1.0,1.0,1.0], ind);
		ind+=3;

    }

}







windMesh.findBest = function(out, candidate, points, bestRadius, indPoints){

	var cRadius = Infinity;


	// Find distance between existing points using a 2D grid
	if (indPoints){
		for (var i = 0; i<indPoints.length; i++){
			var radius = windMesh.distGreatArc(candidate, points[indPoints[i]]);

			if (radius < cRadius)
				cRadius = radius;
		}

	} else {
		// Find distance between existing points
		points.forEach(function(point){
			//var radius = vec3.distance(candidate, point);
			var radius = windMesh.distGreatArc(candidate, point);
			//console.log("RADIUS: ", radius);
			if (radius < cRadius)
				cRadius = radius;
		});
	}

	

	// Save the candidate that is farther apart from the other points
	if (!bestRadius || cRadius > bestRadius){
		vec3.copy(out,candidate);
		bestRadius = cRadius;
	}

	return bestRadius;

}