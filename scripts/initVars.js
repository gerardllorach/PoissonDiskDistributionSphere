
document.body.style.overflow = "hidden"
// Create context or gl
var context = GL.create({width: window.innerWidth, height: window.innerHeight});
context.canvas.style.marginLeft = "-10px";
context.canvas.style.marginTop = "-10px";
document.body.appendChild(context.canvas);

// Create renderer (rendeer.js)
var renderer = new RD.Renderer(context);
renderer.sort_by_priority = false;
context.animate();



// INIT GLOBAL VARIABLES
var scene = new RD.Scene();

// CAMERA
//var camPosLatLong = [20,-5, 3.0];
var camPosLatLong = [0,0, 3.0];
var camPos = vec3.create();
vec3.polarToCartesian(camPos, [camPosLatLong[2], camPosLatLong[0] * DEG2RAD, (camPosLatLong[1] -0) * DEG2RAD]);


var camera = new RD.Camera();
camera.perspective(45, gl.canvas.width / gl.canvas.height, 0.01, 1000);
camera.lookAt (camPos, vec3.create(), [0,1,0]);


// WORKER
var isWorker = false;
var myWorker;

if (!!window.Worker){
	myWorker = new Worker("scripts/worker.js");
	myWorker.postMessage({"action": "init", "docURL": document.URL, "camera": camera, "viewport": gl.viewport_data});
	myWorker.isReady = false;
	myWorker.it = 0;
}



// STATS
var stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.left = '0px';
stats.domElement.style.top = '0px';
document.body.appendChild( stats.domElement );








// SCENE NODES
renderer.meshes["sphere"] = GL.Mesh.sphere({radius: 1, lat: 60, "long": 60});
// Earth
var earth = new RD.SceneNode();
earth.mesh = "sphere";
earth.textures = ["earth"];
earth.shader = "earth";
earth._uniforms = {u_color: [1,1,1,1]};
renderer.loadTexture("images/earth_black.jpg", {name: "earth", minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR});

//earth.flags.visible = false;

// Wind points
var mywinds = new windMesh(document.URL, windLoaded);

var windPoints = new RD.SceneNode();
windPoints.mesh = "wind_points";
windPoints.shader = "point";
windPoints._uniforms = {u_color: [1,1,1,1], u_pointSize: 2.0};
windPoints.primitive = gl.POINTS;
function windLoaded(){
	renderer.meshes["wind_points"] = mywinds.mesh;
	renderer.meshes["wind_lines"] = mywinds.meshLines;
}
windPoints.flags.visible = true;


// Wind lines
var windLines = new RD.SceneNode();
windLines.speed = 3;
windLines.mesh = "wind_lines";
windLines.textures = ["windScale"];
windLines.shader = "windPath";//"point";
windLines.it = 0;
windLines.flags = {blend: true};// depth_write: false
windLines._uniforms = {u_color: [1,1,1,1], u_it: windLines.it, u_pointSize: 2.0};
windLines.primitive = gl.LINE_STRIP;
renderer.loadTexture("images/windScale.png", {name: "windScale", minFilter: gl.LINEAR_MIPMAP_LINEAR, magFilter: gl.LINEAR});
windLines.flags.visible = true;

scene.root.addChild(earth);
scene.root.addChild(windPoints);
scene.root.addChild(windLines);


// SHADERS
function loadShaders(){
	GL.loadFileAtlas("shaders.txt", function(files){
		renderer.shaders["earth"] = new GL.Shader(files["earth.vs"], files["earth.fs"]);
		renderer.shaders["point"] = new GL.Shader(files["point.vs"], files["point.fs"]);
		renderer.shaders["windPath"] = new GL.Shader(files["windPath.vs"], files["windPath.fs"]);
	});
}

loadShaders();