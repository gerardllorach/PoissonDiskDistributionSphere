// Using Render to Texture to draw in empty slots




// --- General approach
// - Generate points with dart throwing. How many iterations?
// - Render to texture
// - Add new points in free spaces
// - Repeat R2T and further steps


// --- Render to texture process:
// First, background one color
// Second, mesh another color (free space)
// Third, points with radi (non-free space)



// --- Add new points:
// - Read the image progressively through lines
// - When free space found -> Keep reading until end found or maxPixRead. Rand between Rank and then do column. add point and jump lines and columns
// - Keep reading and repeat


// The R2T doens't need high resolution
// How to throw the darts only in the free spaces?


windMesh.prototype.initR2T = function(){

	// add shaders, texture to draw, circle texture

	this.radLimit = 0.04;

	return windMesh.createPoissonDiskDartThrowing(this.numPoints, this.points, this.radLimit, this.vertexArray, this.normalArray);

}

// draw function
// how am I gonna draw circles? Create a mesh containing quads for each point?

// read image and add new points