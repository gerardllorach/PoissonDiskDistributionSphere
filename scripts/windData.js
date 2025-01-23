

function windData(){
	// that.data = {};
	// that.X = {};
	// that.Y = {};
	// that.time = "";
}

windData.prototype.loadData = function(url, on_complete){

	var that = this;
	var xhr = new XMLHttpRequest();
	xhr.open('GET', url, true);
	xhr.responseType = "arraybuffer";


	xhr.onload = function()
	{
		var response = this.response;
		if(this.status < 200 || this.status >= 300)
			return console.error("File not found: ", this.status);

		that.data = decoder.decodeEpak(this.response);
		console.log(that.data);

		that.X = that.data.blocks[0];
		that.Y = that.data.blocks[1];

		that.time = that.data.header.variables.time.data;

		if (on_complete)
			on_complete();

		return;
	}

	xhr.send();
	return xhr;
}




