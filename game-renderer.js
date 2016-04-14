var _gameData = {"id":20,"turnCount":2,"turnOffset":0,"spatialMap":{"0":{"0":[{"player":0,"type":"MOTHERSHIP","pos":[0,0]}]},"1":{"0":[{"player":1,"type":"MOTHERSHIP","pos":[1,0]}]}},"pieces":[{"player":0,"type":"MOTHERSHIP","pos":[0,0]},{"player":1,"type":"MOTHERSHIP","pos":[1,0]}],"playersById":{"1":{"id":1,"username":"kaesve","order":1,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}},"2":{"id":2,"username":"Oakenos","order":0,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}}},"playersInOrder":[{"id":2,"username":"Oakenos","order":0,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}},{"id":1,"username":"kaesve","order":1,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}},{"id":2,"username":"Oakenos","order":0,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}},{"id":1,"username":"kaesve","order":1,"playing":true,"nest":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":0,"SCOUT":3}}],"startShipCount":{"CRAWLER":2,"HOPPER":3,"MOTHERSHIP":1,"SCOUT":3},"selected":null,"lastMoveCreated":1459716260}


var boardR = 21;
var schafliSymbol = 6;

var neighborOffsets = [
	[ -1, -1 ], // top left
	[  0, -1 ], // top right
	[  1,  0 ], // right
	[  1,  1 ], // bottom right
	[  0,  1 ], // bottom left
	[ -1,  0 ], // left
];

var _h = unityHexagon;
var setBoardR;

function onLoad() {
	var unityHexagon = unityNGon2(6);
	var rendertarget = document.getElementById('game_rendersurface');
	var ctx = rendertarget.getContext('2d');

	var w = rendertarget.width = 1000;
	var h = rendertarget.height = 1000;

	var boardR;
	var tileR;
	var tileA;
	var tileSide;
	setBoardR = function(r) {
		boardR = r;
		tileR = Math.min(w, h) / boardR / 2;
		tileA = Math.sqrt(3.0)*0.5*tileR;
		tileSide = tileR;
	}
	setBoardR(21);

	var fontStack = "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";

	ctx.translate(w/2, h/2);
	ctx.lineWidth = 1;
	ctx.strokeStyle = "rgba(255,255,255, 0.6)";
	ctx.font = tileA + fontStack;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	ctx.fillStyle = "rgba(255,255,255, 0.3)";

	var b = document.body;
	b.style.borderColor = "rgb(20, 20, 20)";
	b.style.color = "rgb(1, 1, 1)";

	function centerOfTile(boardSpace) {
		return [ tileA*2*(boardSpace[0] - boardSpace[1]/2),
				1.5*tileR*boardSpace[1]];
	}

	function tileFromPixel(pixelSpace) {
		var x = (pixelSpace[0]) / (2.0*tileA);
		var y = Math.round(pixelSpace[1] / (1.5*tileR));
		return [Math.round(x + y/2), y];
	}

	function constructHexagon(ctx, center, r) {
		var v = addV2(center, sclV2(unityHexagon[0], r));
		ctx.beginPath();
		ctx.moveTo(v[0], v[1]);
		for (var i = 1; i < schafliSymbol; ++i) {
			v = addV2(center, sclV2(unityHexagon[i], r));
			ctx.lineTo(v[0], v[1]);
		}
		ctx.closePath();
	}


	var blue = "rgba(33, 168, 214, 1)";
	var red = "rgb(236, 33, 76)";

	var playerColormap = [ blue, red ];


	var spotlightP;
	var hotTile;
	var hotTileChangeT = 0;
	function update(input) {
		var gameData = _gameData;


		if (input.mDowns.length) {
			var t = tileFromPixel([input.mAt[0] - w/2, input.mAt[1] - h/2]);
			if (!hotTile || t[0] != hotTile[0] || t[1] != hotTile[1]) {
				hotTile = t;
			} else if (t[0] == hotTile[0] && t[1] == hotTile[1]) {
				hotTile = false;
			}
			hotTileChangeT = input.t;
			console.log(hotTile);
		}



		ctx.clearRect(-w/2, -h/2, w, h);
		if (!spotlightP) {
			spotlightP = input.mAt;
		} if (hotTile) {
			spotlightP = hotTile;
		} else {
			spotlightP = addV2(spotlightP, sclV2(negV2(tileFromPixel(negV2(input.mAt, [w/2, h/2])), spotlightP), 0.25));
		}

		var nest = gameData.playersInOrder[0].nest;
		ctx.fillStyle = playerColormap[0];
		var i = 1;
		for (var shipName in nest) {
			if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
			v = centerOfTile([i, Math.floor(boardR/2)]);
			constructHexagon(ctx, v, tileR*1.2);
			ctx.fill();

			i += 2;
			ctx.globalAlpha = 1;
		}

		nest = gameData.playersInOrder[1].nest;
		ctx.fillStyle = playerColormap[1];
		var i = 1;
		for (var shipName in nest) {
			if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
			v = centerOfTile([-i, -Math.floor(boardR/2)]);
			constructHexagon(ctx, v, tileR*1.2);
			ctx.fill();

			i += 2;
			ctx.globalAlpha = 1;
		}

		ctx.fillStyle = "white";
		constructHexagon(ctx, centerOfTile(spotlightP), tileR*1.2);
		ctx.fill();

		var c1 = b.style.color;
		c1 = mapOver(c1.substring(4, c1.length - 1).split(', '), function(c) { return parseInt(c); });
		var c2 = b.style.borderColor;
		c2 = mapOver(c2.substring(4, c2.length - 1).split(', '), function(c) { return parseInt(c); });

		ctx.textBaseline = 'alphabetic';
		ctx.font = "500 " + tileR*1.5 + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";

		ctx.lineWidth = 2;
		ctx.beginPath();

		var p0 = _h[1];
		var p1 = _h[2];
		var p2 = _h[3];
		p0 = lerpV2(p0, p1, 0.9);
		p2 = lerpV2(p1, p2, 0.3);

		p0 = sclV2(p0, 2*tileA * (1 + boardR)/2);
		p1 = sclV2(p1, 2*tileA * (1 + boardR)/2);
		p2 = sclV2(p2, 2*tileA * (1 + boardR)/2);
		
		ctx.moveTo(p0[0], p0[1]);
		ctx.lineTo(p1[0], p1[1]);
		ctx.lineTo(p2[0], p2[1]);
		
		ctx.strokeStyle = blue;
		ctx.stroke();

		ctx.fillStyle = playerColormap[0];
		ctx.textAlign = 'right';
		ctx.fillText(gameData.playersInOrder[0].username + " ", p2[0], p2[1]);

		ctx.beginPath();

		p0 = _h[0];
		p1 = _h[5];
		p2 = _h[4];
		p0 = lerpV2(p0, p1, 0.7);
		p2 = lerpV2(p1, p2, 0.1);

		p0 = sclV2(p0, 2*tileA * (1 + boardR)/2);
		p1 = sclV2(p1, 2*tileA * (1 + boardR)/2);
		p2 = sclV2(p2, 2*tileA * (1 + boardR)/2);
		
		ctx.moveTo(p0[0], p0[1]);
		ctx.lineTo(p1[0], p1[1]);
		ctx.lineTo(p2[0], p2[1]);
		
		ctx.strokeStyle = red;
		ctx.stroke();

		ctx.fillStyle = playerColormap[1];
		ctx.textAlign = 'left';
		ctx.fillText(" " + gameData.playersInOrder[1].username, p0[0], p0[1]);

		/// TODO: would it be better to do this with ctx.save() and restore()?
		ctx.textAlign = 'center';
		ctx.font = tileA + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
		ctx.textBaseline = 'middle';


		ctx.globalCompositeOperation = "screen";
		ctx.globalAlpha = 0.8;
		for (var x in gameData.spatialMap) {
			for (var y in gameData.spatialMap[x]) {
				var ship = gameData.spatialMap[x][y][0];
				if (ship) {
					var v = centerOfTile([parseInt(x), parseInt(y)]);
					constructHexagon(ctx, v, tileR*1.1);
					ctx.fillStyle = playerColormap[ship.player];
					ctx.fill();
				}
			}
		}
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "normal";


		// for (var x = -boardR/2; x < Math.floor(boardR/2); ++x) {
		// 	var v = sclV2(unityHexagon[0], tileR*0.9);
		// 	ctx.beginPath();
		// 	ctx.moveTo(v[0], v[1] + x*tileA);
		// 	for (var i = 1; i < schafliSymbol; ++i) {
		// 		v = sclV2(unityHexagon[i], tileR*0.9);
		// 		ctx.lineTo(v[0], v[1] + x*tileA);
		// 	}
		// 	ctx.closePath();
		// 	ctx.stroke();
		// }
		// m[0] = 0;

		fillR = tileR*(1 -0.025); //+ 2*m[0]/w + 2*(Math.abs(orientation[2]))/90;


		constructHexagon(ctx, [0, 0], fillR);
		ctx.fillStyle = "rgb(" + mapOver(c2, Math.round).join(", ") + ")";
		ctx.fill();

		for (var ring = 1; ring < boardR / 2; ++ring) {

			var offset = sclV2(neighborOffsets[1], ring);
			var _offset = centerOfTile(offset);
				

			for (var j = 0; j < schafliSymbol; ++j) {
				var dOFfset = neighborOffsets[(j + 3) % schafliSymbol];
				var _t = ring/(boardR / 2);
				var c = [
					Math.round(lerp(c1[0], c2[0], _t*_t)),
					Math.round(lerp(c1[1], c2[1], _t*_t)),
					Math.round(lerp(c1[2], c2[2], _t*_t)),
				];
				ctx.fillStyle = "rgb(" + c.join(", ") + ")";
				for (var k = 0; k < ring; ++k) {

					offset = addV2(offset, dOFfset);
					_offset = centerOfTile(offset);

					ctx.beginPath();
					ctx.arc(_offset[0], _offset[1], tileA, 0, TAU);
					// ctx.fill();
					
					constructHexagon(ctx, _offset, fillR);
					ctx.fill();
				}
			}
		}

		for (i = 0; i < gameData.pieces.length; ++i) {
			var ship = gameData.pieces[i];
			var v = centerOfTile(ship.pos);
			ctx.fillStyle = playerColormap[ship.player];
			ctx.fillText(ship.type[0], v[0], v[1]);
			// ctx.drawImage(sprites[ship.player].mothership, v[0], v[1]);
		}


		nest = gameData.playersInOrder[0].nest;
		ctx.lineWidth = 8;
		i = 1;
		for (var shipName in nest) {
			if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
			
			ctx.fillStyle = playerColormap[0];

			v = centerOfTile([i, Math.floor(boardR/2)]);
			ctx.fillText(shipName[0], v[0], v[1]);
			v = centerOfTile([i + 1, 1 + Math.floor(boardR/2)]);

			constructHexagon(ctx, v, tileR*0.6);
			ctx.fill();
			// ctx.fillStyle = playerColormap[0];
			ctx.fillStyle = 'black';
			ctx.fillText("" + nest[shipName], v[0], v[1]);
			
			i += 2;
			ctx.globalAlpha = 1;
		}


		nest = gameData.playersInOrder[1].nest;
		ctx.lineWidth = 8;
		i = -1;
		for (var shipName in nest) {
			if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
			
			ctx.fillStyle = playerColormap[1];

			v = centerOfTile([i, -Math.floor(boardR/2)]);
			ctx.fillText(shipName[0], v[0], v[1]);
			v = centerOfTile([i - 1, -1 - Math.floor(boardR/2)]);

			constructHexagon(ctx, v, tileR*0.6);
			ctx.fill();
			// ctx.fillStyle = playerColormap[0];
			ctx.fillStyle = 'black';
			ctx.fillText("" + nest[shipName], v[0], v[1]);
			
			i -= 2;
			ctx.globalAlpha = 1;
		}
	}

	startLoop(update);
}