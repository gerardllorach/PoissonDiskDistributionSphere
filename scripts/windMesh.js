// TODO: update functions for datthrowing and mitchell. Grid needs to be updated
// Other solution: skip grid and work with mesh, better for updating
// What about Render to Texture solution? Grid could be used to initialize?
// Grid size has to match number of points (radii)

// Utilities for worker
//var isWorker = true;
//self.camera = [];

//self.camera.viewport = [0,0,256,256];


function windMesh(docURL, on_complete){

	// Worker util
	if (!isWorker){
		camera.viewport = gl.viewport_data;
	}


	// WIND DATA
	//http://earth.nullschool.net/data/weather/current/current-wind-surface-level-gfs-0.5.epak
	this.working = true;
	this.wData = new windData();
	var url = docURL + "data/wind.epak";
	var that = this;
	this.wData.loadData(url, function(){
		
		
		that.init("mitchell", 2000, true, 100, 4, 10);
		
		if (on_complete)
			on_complete();
	});


}



windMesh.prototype.init = function(strategy, numPoints, gridOn, gridSize, radLimit, numCandidates){
	var t0 = performance.now();

	this.working = true;

	this.points = [];



	this.numPoints = numPoints || 2000;

	this.pathSize = 20;
	this.step = 0.0005;
	this.color = [1.0,1.0,1.0];

	this.vertexArray = new Float32Array(this.numPoints*3);
	this.normalArray = new Float32Array(this.numPoints*3);

	this.vertexArrayLines = new Float32Array( (this.numPoints * (this.pathSize+1) + 2*this.numPoints)*3);
	this.normalArrayLines = new Float32Array( (this.numPoints * (this.pathSize+1) + 2*this.numPoints)*3);


	// Grid
	this.gridAct = gridOn;
	this.grid = [];
	this.gridIndices = []; // Close cells indices
	this.gridSize = gridSize || 50;
	this.toBeAdded = [];

	this.limits = [];
	this.gridLimits(this.limits);

	this.createGridIndices();



	if (strategy == "dart"){
		this.initDart(radLimit);
		this.update = this.updateDart;
		this.updateZoomOut = this.updateZoomOutDart;
	} else if (strategy == "mitchell"){
		this.initMitchell(numCandidates);
		this.update = this.updateMitchell;
		this.updateZoomOut = this.updateZoomOutMitchell;
	} else if (strategy == "random") {
		//numPoints, points, vertexArray, normalArray
		//this.mesh = windMesh.randomPoints(this.numPoints, this.points, this.vertexArray, this.normalArray);
		this.randomPoints();
		this.update = this.updateRandom;
		this.updateZoomOut = this.updateZoomOutRand;
	} else {
		//this.mesh = windMesh.randomPoints(this.numPoints, this.points, this.vertexArray, this.normalArray);
		this.randomPoints();
		this.update = this.updateRandom;
		this.updateZoomOut = this.updateZoomOutRand;
	}


	// Updates cancel
	//this.update = function(){};
	//this.updateZoomOut = function(){};

	// createWindLines(point, pathSize, step, windData, vertexArray, normalArray, arrayIndex)
	var buffer = windMesh.createWindLines(this.points, this.pathSize, this.step, this.wData,
			this.vertexArrayLines, this.normalArrayLines);

	this.vertexArrayLines = buffer["vertices"];
	this.normalArrayLines = buffer["normals"];



	if (!isWorker){
		this.assignBuffers();
	} else {
		// Put vertices and normals together for sending them.
		this.bufferArray = new Float32Array(this.vertexArray.length*2);
		this.bufferArrayLines = new Float32Array(this.vertexArrayLines.length*2);
		sendArrays();
	}

	this.working = false;

	var t1 = performance.now();
		console.log("Calculation time: ", parseInt(t1-t0), "ms");
}





windMesh.createWindLines = function (points, pathSize, step, windData, vertexArray, normalArray){

	for (var i = 0; i < points.length; i++){
		if (points[i])
			windMesh.createWindPath(points[i], pathSize, step, windData, vertexArray, normalArray, i);
	}

	var buffers = {
		vertices: vertexArray,
		normals: normalArray
	};
	return buffers;
}





windMesh.createWindPath = function(point, pathSize, step, windData, vertexArray, normalArray, pointIndex){

	var R = 1;
	var index = (pointIndex*(3 + pathSize))*3;


	var p = [];
	p[0] = point[0];
	p[1] = point[1];
	p[2] = point[2];


	// 3D to UV
	var latLong = windMesh.cartesianToLatLong([], p);
	var it = Math.random()*400;

	// Connectivity empty point
	//vertexArray.set(p, index);
	vertexArray.set([latLong[0], latLong[1], it], index);
	normalArray.set([0,0,0], index);
	index+=3;

	// Initial point	
	//vertexArray.set(p, index);
	vertexArray.set([latLong[0], latLong[1], it], index);
	normalArray.set([1,1,1], index); // could have a color!
	index+=3;



	for (var j =0 ; j<pathSize; j++){
		
		
		// 3D point to lat-long
		windMesh.cartesianToLatLong(latLong, p);

		
		// 3D point to UV
		var UV = windMesh.cartesianToUV([], p);

		// Interpolate
		var interpolatedWind = windMesh.bilinearInterpolation(UV, windData);

		var row = Math.floor(UV[0] * 361); // Range should be 0-361
		var col = Math.floor(UV[1] * 720); // Range should be 0-720
		var ind = row*720 + col;
		

		var vecMagnitude = Math.sqrt(interpolatedWind[0]*interpolatedWind[0] + interpolatedWind[1]*interpolatedWind[1]);
		//var normX = windData.X[ind]/vecMagnitude;
		//var normY = windData.Y[ind]/vecMagnitude;

		// TODO: increment should be improved in the 3D space, artifacts in the poles
		// Store new point and repeat
		
		//console.log(windData.X[ind], windData.Y[ind], "  " , interpolatedWind);


		//interpolatedWind[0] = 2;
		//interpolatedWind[1] = 2;


		// var newLat = windData.X[ind]*step + latLong[0];
		// var newLong = windData.Y[ind]*step + latLong[1];
		//var newLat = interpolatedWind[0]*step + latLong[0];
		//var newLong = interpolatedWind[1]*step + latLong[1];
		//windMesh.latLongToCartesian(p, [newLat, newLong]);

		var newLatLong = windMesh.windPathIncr([], latLong, interpolatedWind, step, j);
		windMesh.latLongToCartesian(p, newLatLong);

		
		


		//vertexArray.set(p, index);
		it += vecMagnitude;
		vertexArray.set([latLong[0], latLong[1], it], index);

		// Color
		//normalArray.set([1,normX,normY], index);
		var red = 0;
		var green = 0;
		var blue = 0;

		if (vecMagnitude < 3){
			blue = vecMagnitude / 3; // 0 to 1
			green = 0;
			red = 0;
		}
		if (vecMagnitude >= 3 && vecMagnitude < 8){
			blue = (8 - vecMagnitude)/5; // 1 to 0
			green = (vecMagnitude-3)/5; // 0 to 1
			red = vecMagnitude > 7 ? (vecMagnitude-7)/1 : 0; // 0 until 7, then 0 to 1
		}
		if (vecMagnitude >= 8){
			blue = vecMagnitude > 15 ? (vecMagnitude-15)/5 : 0; // 0 unti 15, then 0 to 1 from 15 to 20
			green = vecMagnitude > 12 ? 0 : (12 - vecMagnitude)/4; // 1 to 0 until 12, then 0
			red = 1;
		}

		normalArray.set([red,green,blue], index);
		//normalArray.set([1, 2 + j, Math.min(vecMagnitude/30, 1)], index);
		index+=3;

		if (vecMagnitude > 30)
			console.log("Wind is bigger than 30: ", vecMagnitude);
	}

	//vertexArray.set(p, index);
	vertexArray.set([latLong[0], latLong[1], it], index);
	normalArray.set([0,0,0], index);
	index+=3;


    return index;
}




windMesh.windPathIncr = function ( out, latLong, incrVec, step, j){
	// There might be a direct function that calculates distortion on the UV map and can be applied to incrVec

	var mag = Math.sqrt(incrVec[0]*incrVec[0] + incrVec[1]*incrVec[1]);

	var angle = Math.atan2(incrVec[1], incrVec[0]);

	var p = windMesh.latLongToCartesian([], latLong);


	// get vectorial product with p <x>Y to rotate towards the equator and poles
	var p_up_cross = vec3.cross([], p, [0,1,0]);
	vec3.normalize(p_up_cross, p_up_cross);

	// rotate in p-Y plane to set in the equator
	var angToEquator = Math.PI/2 - Math.acos(p[1]);
	var q = quat.setAxisAngle([], p_up_cross, -angToEquator);
	var p_Equator = vec3.transformQuat([], p, q);

	// rotate in XZ plane
	quat.setAxisAngle(q, [0,1,0], step*Math.cos(angle) * mag);
	var p_Eq_XZ = vec3.transformQuat([], p_Equator, q);

	// rotate back in the p-Y plane and add to the rotation the increment
	quat.setAxisAngle(q, p_up_cross, angToEquator +  step*Math.sin(angle) * mag);

	var p_final = vec3.transformQuat([], p_Eq_XZ, q);
	vec3.normalize(p_final, p_final);


	windMesh.cartesianToLatLong(out, p_final);

	return out;
}














windMesh.createCandidate = function(out, camera, limits){

	// Create a random point on the sphere. A lot of points will fall outside
	// the desired surface, should we avoid this step and project directly?
	// Probably not, because then the distribution won't be  equal, as we are
	// projecting from a 2D plane (camera frustrum) to a 3D sphere.
	var theta = Math.acos(1-2*Math.random());
	var sinTheta = Math.sin(theta);
	var cosTheta = Math.cos(theta);

	var phi = 2*Math.PI*Math.random();
	var sinPhi = Math.sin(phi);
	var cosPhi = Math.cos(phi);

	out[0] = cosPhi * sinTheta;
	out[1] = cosTheta;
	out[2] = sinPhi * sinTheta;


	// Points outside the viewport
	//var screenPos = windMesh.cameraProject(out,  camera._viewprojection_matrix, camera.viewport);
	var width =  camera.viewport[2]; var height =  camera.viewport[3];
	
	//var outsideScreen = (screenPos[0]<0 || screenPos[0]>width || screenPos[1]<0 || screenPos[1]>height );

	//var behindSphere = vec3.distance(out, camera.position) > vec3.length(camera.position)+0.2;
	var isOut = windMesh.isOutsideBounds(out, camera);

	if (isOut){
		
		limits = limits || [height, 0, width, 0];


		
		// ERROR NOT SOLVED: For some reason, when the aspect is bigger than 3, camera.project doesn't work well in the horizontal axis
		// the calculation of limits and all that involves camera.project will be wrong (such as reprojecting the points to the grid)
		if (width/height > 3 && vec3.length(camera.position) < 1.2){ 
			var rX = Math.random()*width;
			var rY = Math.random()*height;
		} else {
			var rX = Math.random()*(limits[2] - limits[3]) + limits[3];
			var rY = Math.random()*(limits[0] - limits[1]) + limits[1];
		}

		

		var ray = vec3.normalize(vec3.create(), windMesh.cameraUnproject([rX, rY, 1], camera));
		
		var result = vec3.create();
		if( windMesh.testRaySphere(camera.position, ray, [0,0,0], 1.0, result))
			vec3.copy(out, result);
	}
	// Points behind the sphere (using camera distance)
	if (vec3.distance(out, camera.position) > vec3.length(camera.position)+0.2){
		out[0]*=-1;
		out[1]*=-1;
		out[2]*=-1;

	}

	isOut = windMesh.isOutsideBounds(out, camera);

	if (isOut){
		return [];
	}

	
	return out;
}


// outsideScreen or behind sphere
windMesh.isOutsideBounds = function(p, camera){
	var width =  camera.viewport[2]; var height =  camera.viewport[3];
	var screenPos = windMesh.cameraProject(p,  camera._viewprojection_matrix, camera.viewport);

	var outsideScreen = (screenPos[0]<0 || screenPos[0]>width || screenPos[1]<0 || screenPos[1]>height);

	var behindSphere = vec3.distance(p, camera.position) > vec3.length(camera.position)+0.2;
	// if camDistance < radius
	if (vec3.length(camera.position) - 1 < 1)
		behindSphere = vec3.distance(p, camera.position) > (vec3.length(camera.position)-1)*2;

	return (outsideScreen || behindSphere);
}


windMesh.prototype.addToGrid = function (screenPos, i) {
	// Need the grid, should be adapted to screen size?
	// All points are unprojected at every update, this is an extra cost that will make checking distances between points faster when updating

	// If radius is small, grid can be small
	var grid = this.grid;
	var gridSize = this.gridSize;


	// TODO!
	// I should optimize the grid when the earth is smaller than screen. The grid will be updated every frame, so it can also adapt and change
	var limits = this.limits;

	var newWidth = limits[2] - limits[3];
	var newHeight = limits[0] - limits[1];

	var rowCol = [Math.floor(gridSize*(screenPos[1]-limits[1])/newHeight), Math.floor(gridSize*(screenPos[0]-limits[3])/newWidth)];
	
	//var rowCol = [Math.floor(gridSize*screenPos[1]/window.innerHeight), Math.floor(gridSize*screenPos[0]/window.innerWidth)];

	var index = windMesh.rowColToIndex(rowCol, gridSize);


	// No points in cell
	if (!grid[index])
		grid[index] = [];

	grid[index].push(i);

	

}





windMesh.prototype.getNearbyIdPointsWithGrid = function(out, screenPos){

	var grid = this.grid;
	var gridSize = this.gridSize;

	
	// Calculate the bounds of the sphere to fit the grid into only this space, not the whole screen
	var limits = this.limits;

	var newWidth = limits[2] - limits[3];
	var newHeight = limits[0] - limits[1];

	var rowCol = [Math.floor(gridSize*(screenPos[1]-limits[1])/newHeight), Math.floor(gridSize*(screenPos[0]-limits[3])/newWidth)];
	//var rowCol = [Math.floor(gridSize*screenPos[1]/window.innerHeight), Math.floor(gridSize*screenPos[0]/window.innerWidth)];

	var index = windMesh.rowColToIndex(rowCol, gridSize);

	// Point is already outside the screen
	if (rowCol[0]<0 || rowCol[0]>=gridSize || rowCol[1]<0 || rowCol[1]>=gridSize){
		return [];
	}

	// Get the cells to look
	var cellsInd = this.gridIndices[index];

	if (!cellsInd){
		console.log(screenPos, rowCol, index, gridSize*gridSize, this.gridIndices.length);
	}

	// Get the points inside those cells
	var numCellsInd = cellsInd.length;
	for (var i = 0; i < numCellsInd; i++){
		
		var gridIndex = cellsInd[i];
		// If cell exists
		if (this.grid[gridIndex]){
			
			// Go over the points inside the cell
			for (var j = 0; j<this.grid[gridIndex].length; j++){
				// Add point index to the output
				out.push(this.grid[gridIndex][j]);
			}
		
		}
	}
}



windMesh.prototype.gridLimits = function(out){
	var mLookAt = mat4.lookAt(mat4.create(), camera.position, [0,0,0], [0,1,0]);
	mat4.invert(mLookAt, mLookAt);
	
	var width = camera.viewport[2];
	var height = camera.viewport[3];

	// Up
	var v = [0,1.2,0];
	windMesh.rotateVec3(v, mLookAt, v);
	var screenPos = windMesh.cameraProject(v, camera._viewprojection_matrix, camera.viewport);

	out[0] = screenPos[1] > height ? height : screenPos[1];


	// Down
	v = [0,-1.2,0];
	windMesh.rotateVec3(v, mLookAt, v);
	screenPos = windMesh.cameraProject(v, camera._viewprojection_matrix, camera.viewport);

	out[1] = screenPos[1] < 0 ? 0 : screenPos[1];


	// Right
	v = [1.2,0,0];
	windMesh.rotateVec3(v, mLookAt, v);
	screenPos = windMesh.cameraProject(v, camera._viewprojection_matrix, camera.viewport);

	out[2] = screenPos[0] > width ? width * 1.2 : screenPos[0];


	// Left
	v = [-1.2,0,0];
	windMesh.rotateVec3(v, mLookAt, v);
	screenPos = windMesh.cameraProject(v, camera._viewprojection_matrix, camera.viewport);

	out[3] = screenPos[0] < 0 ? 0 : screenPos[0];

	return out;

}



// Problem with cells! They change when user interact, so the creation of the grid should be fast
// Small grid should be faster to create than a bigger one, but then too many points are inside the cells


// Will have to check inside 8 cells
// Not very effective. I could check where the point is inside the cell (close to corner, edge, middle). For ex.: if cells are 
// big and point is in the middle no need to check other cells

// Compromise!! This is why papers make cells with sizes correlated with the radii.

// Small cells solution
windMesh.prototype.createGridIndices = function (){

	var grid = this.grid;
	var gridSize = this.gridSize;
	var gridIndices = this.gridIndices;

	var rowCol = [];
	var row;
	var col;


	for (var i = 0; i < this.gridSize*this.gridSize; i++){

		windMesh.indexToRowCol(rowCol, i, gridSize, gridSize);

		row = rowCol[0];
		col = rowCol[1];


		// Upper Cells
		var cellUpLeft = [row-1, col-1];
		var cellUp = [row-1, col];
		var cellUpRight = [row-1, col+1];

		// Middle Cells
		var cellLeft = [row, col-1];
		var cellMiddle = [row, col];
		var cellRight = [row, col+1];

		// Bottom cells
		var cellBotLeft = [row+1, col-1];
		var cellBottom = [row+1, col];
		var cellBotRight = [row+1, col+1];


		// Row Col to Index
		var cellsIndices = [];
		cellsIndices.push(windMesh.rowColToIndex( cellUpLeft, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellUp, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellUpRight, gridSize));

		cellsIndices.push(windMesh.rowColToIndex( cellLeft, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellMiddle, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellRight, gridSize));

		cellsIndices.push(windMesh.rowColToIndex( cellBotLeft, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellBottom, gridSize));
		cellsIndices.push(windMesh.rowColToIndex( cellBotRight, gridSize));

			
		// Limits of grid
		if (rowCol[0] == 0){
			cellsIndices[0] = undefined;
			cellsIndices[1] = undefined;
			cellsIndices[2] = undefined;
		}
		if (rowCol[1] == 0){
			cellsIndices[0] = undefined;
			cellsIndices[3] = undefined;
			cellsIndices[6] = undefined;
		}
		if (rowCol[0] == gridSize-1){
			cellsIndices[6] = undefined;
			cellsIndices[7] = undefined;
			cellsIndices[8] = undefined;
		}
		if (rowCol[1] == gridSize-1){
			cellsIndices[2] = undefined;
			cellsIndices[5] = undefined;
			cellsIndices[8] = undefined;
		}


		gridIndices[i] = [];

		for (var j = 0; j < 9; j++){
			
			if (cellsIndices[j] || cellsIndices[j] == 0){
				gridIndices[i].push(cellsIndices[j]);
			}
		}

	}



}








windMesh.prototype.assignBuffers = function(){

	var buffers = { 
     	vertices: this.vertexArray,
     	normals:  this.normalArray
     };
	this.mesh = Mesh.load(buffers);
	renderer.meshes["wind_points"] = this.mesh;


	buffers = {
		vertices: this.vertexArrayLines,
		normals: this.normalArrayLines
	};
	this.meshLines = Mesh.load(buffers);
	renderer.meshes["wind_lines"] = this.meshLines;

}















windMesh.bilinearInterpolation = function (p_uv, data){
	// p is [u, v]

	var latSampling = 361;
	var longSampling = 720;

	// Find Row and Col from neighbours inside data
	var arrIndexs = [];
	arrIndexs[0] = [Math.floor(p_uv[0] * latSampling), Math.floor(p_uv[1] * longSampling)];
	arrIndexs[1] = [Math.ceil(p_uv[0] * latSampling), Math.floor(p_uv[1] * longSampling)];
	arrIndexs[2] = [Math.floor(p_uv[0] * latSampling), Math.ceil(p_uv[1] * longSampling)];
	arrIndexs[3] = [Math.ceil(p_uv[0] * latSampling), Math.ceil(p_uv[1] * longSampling)];


	var arrDist = [];
	var sumDist = 0;
	for (var i = 0; i < 4; i ++){
		// Calculate Lat and Long of neighbours. Transform Row-Col to Lat-Long
		var uv = [arrIndexs[i][0]/latSampling,  arrIndexs[i][1]/longSampling];
		var latLong = windMesh.UVToLatLong([], uv);

		// Calculate distances between neighbours and target
		arrDist[i] = windMesh.distGreatArcLatLong ( windMesh.UVToLatLong ([], p_uv) , latLong);
		
		sumDist += arrDist[i];
	}

	

	// Calculate weights
	var weights = [];
	var sumWeights = 0;
	for (var i = 0; i<4; i++){
		weights[i] = 1 - arrDist[i]/sumDist;
		sumWeights += weights[i];
	}


	// Calculate interpolated value
	var value = [];
	value[0] = value[1] = 0;
	for (var i = 0; i < 4; i++){
		var index = arrIndexs[i][0]*longSampling + arrIndexs[i][1];
		var w = weights[i]/sumWeights;

		value[0] += data.X[index] * w;
		value[1] += data.Y[index] * w;
	}

	return value;

}





windMesh.distGreatArc = function( p , q , r){

	var R = r || 1;

	var latLong1 = [];
	windMesh.cartesianToLatLong (latLong1, p);

	var latLong2 = [];
	windMesh.cartesianToLatLong (latLong2, q);


	return windMesh.distGreatArcLatLong( latLong1, latLong2);
}


windMesh.distGreatArcLatLong = function ( p , q , r){

	var R = r || 1; 

	var incLat = (q[0] - p[0]);
	var incLong = (q[1] - p[1]);

	var a = Math.sin(incLat/2) * Math.sin(incLat/2) +
	        Math.cos(p[0]) * Math.cos(q[0]) *
	        Math.sin(incLong/2) * Math.sin(incLong/2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

	return R * c;
}

// 3D point to lat-long
windMesh.cartesianToLatLong = function(out, p, r){
	var R = r || 1;

	out[0] = Math.PI/2 - Math.acos(p[1] / R);
	out[1] = Math.atan2(p[2] , p[0]);

	return out;
}

// 3D point to UV
windMesh.cartesianToUV = function(out, p, r){
	var R = r || 1;

	out[0] = Math.acos(p[1] / R) / Math.PI;
	var llong = Math.atan2(p[2] , p[0]);
	out[1] = llong >= 0 ? llong/(2*Math.PI) : (llong + 2*Math.PI)/(2*Math.PI);

	return out;
}

// latlong to 3D point
windMesh.latLongToCartesian = function (out, latLong, r){
	var R = r || 1;
	
	out[0] = R * Math.cos(latLong[0]) * Math.cos(latLong[1]);
	out[1] = R * Math.sin(latLong[0]);
	out[2] = R * Math.cos(latLong[0]) * Math.sin(latLong[1]);

	return out;
}

// UV to latLong
windMesh.UVToLatLong = function (out, uv){
	out[0] = (1.0-2.0*uv[0]) * Math.PI/2.0;
	out[1] = uv[1] * 2.0 * Math.PI;

	return out;
}

// latLong to UV
windMesh.latLongToUV = function (out, latLong){
	out[0] = ((latLong[0]/Math.PI) - 0.5) * -1;
	out[1] = latLong[1]/(2*Math.PI);

	return out;
}


// Row Col to Index
windMesh.rowColToIndex = function(rowCol, nCol){
	return (rowCol[0]*nCol + rowCol[1]);
}

// Index to Row Col
windMesh.indexToRowCol = function (out, index, nRows, nCols){
	out[0] = Math.floor(index / nCols)
	out[1] = index % nCols;

	return out;
}












// Utilities for worker
windMesh.rotateVec3 = function(out, m, a) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z;
    out[1] = m[1] * x + m[5] * y + m[9] * z;
    out[2] = m[2] * x + m[6] * y + m[10] * z;
    return out;
};



windMesh.cameraProject = function( vec, MVP, viewport, result)
{
	result = result || vec3.create();
	viewport = viewport || gl.viewport_data;

	windMesh.projectVec3(result, MVP, vec );

	//adjust to viewport
	result[0] = result[0] * viewport[2] + viewport[0];
	result[1] = result[1] * viewport[3] + viewport[1];

	return result;
}


windMesh.projectVec3 = function(out, m, a)
{
	var ix = a[0];
	var iy = a[1];
	var iz = a[2];

	var ox = m[0] * ix + m[4] * iy + m[8] * iz + m[12];
	var oy = m[1] * ix + m[5] * iy + m[9] * iz + m[13];
	var oz = m[2] * ix + m[6] * iy + m[10] * iz + m[14];
	var ow = m[3] * ix + m[7] * iy + m[11] * iz + m[15];

	out[0] = (ox / ow + 1) / 2;
	out[1] = (oy / ow + 1) / 2;
	out[2] = (oz / ow + 1) / 2;
	return out;
};


windMesh.cameraUnproject = function( vec, camera, result )
{

	if (isWorker)
		viewport = camera.viewport || [0,0,256,256];
	else
		viewport = camera.viewport || gl.viewport_data;

	return windMesh.unproject( result || vec3.create(), vec, camera._viewprojection_matrix, camera.viewport );
}



windMesh.unproject = function (out, vec, viewprojection, viewport) {

	var MVP = viewprojection || mat4.create();
	var m = mat4.create();
	var v = vec4.create();
	
	v[0] = (vec[0] - viewport[0]) * 2.0 / viewport[2] - 1.0;
	v[1] = (vec[1] - viewport[1]) * 2.0 / viewport[3] - 1.0;
	v[2] = 2.0 * vec[2] - 1.0;
	v[3] = 1.0;
	
	if(!mat4.invert(m,MVP)) 
		return null;
	
	vec4.transformMat4(v, v, m);
	if(v[3] === 0.0) 
		return null;

	out[0] = v[0] / v[3];
	out[1] = v[1] / v[3];
	out[2] = v[2] / v[3];
	
	return out;
};



windMesh.testRaySphere = function(start, direction, center, radius, result)
{
	// sphere equation (centered at origin) x2+y2+z2=r2
	// ray equation x(t) = p0 + t*dir
	// substitute x(t) into sphere equation
	// solution below:

	// transform ray origin into sphere local coordinates
	var orig = vec3.subtract(vec3.create(), start, center);

	var a = direction[0]*direction[0] + direction[1]*direction[1] + direction[2]*direction[2];
	var b = 2*orig[0]*direction[0] + 2*orig[1]*direction[1] + 2*orig[2]*direction[2];
	var c = orig[0]*orig[0] + orig[1]*orig[1] + orig[2]*orig[2] - radius*radius;
	//return quadraticFormula(a,b,c,t0,t1) ? 2 : 0;

	var q = b*b - 4*a*c; 
	if( q < 0.0 )
		return false;

	if(result)
	{
		var sq = Math.sqrt(q);
		var d = 1 / (2*a);
		var r1 = ( -b + sq ) * d;
		var r2 = ( -b - sq ) * d;
		var t = r1 < r2 ? r1 : r2;
		vec3.add(result, start, vec3.scale( vec3.create(), direction, t ) );
	}
	return true;//real roots
}



