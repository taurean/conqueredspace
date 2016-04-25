

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
function initGameRenderer(rendertarget) {
	var r = {
		pos: [0,0],
		target: rendertarget,
		ctx: rendertarget.getContext('2d'),
		dim: [rendertarget.width = 1000, rendertarget.height = 1000],
		halfDim: [500, 500],
		boardR: 21,

		isDirty: true
	};
	r.ctx.translate(r.halfDim[0], r.halfDim[1]);
	return r;
}

var renderAndUpdateGame = (function() {
	var unityHexagon = unityNGon2(6);

	var tileR;
	var tileA;
	var tileSide;

	var fontStack = "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";


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
	return function update(r, input, game, dispatch) {
		var i, v, ship, at;
		if (!game.id) return;

		if (r.isDirty || input.dScrollAt[0] != 0 || input.dScrollAt[1] != 0) {
			// is this a good idea?
			var rect = r.target.getBoundingClientRect();
			r.pos = [rect.left, rect.top];

			r.boardR = r.boardR;
			tileR = Math.min(r.dim[0], r.dim[1]) / r.boardR / 2;
			tileA = Math.sqrt(3.0)*0.5*tileR;
			tileSide  = tileR;
		}
		r.isDirty = false;

		var mAt = negV2(negV2(input.mAt, r.pos), r.halfDim);

		var interacted = input.mDowns.length > 0;
		var interactionAt;
		if (interacted) {
			interactionAt = tileFromPixel(mAt);
			if (!game.hotTile || interactionAt[0] != game.hotTile[0] || interactionAt[1] != game.hotTile[1]) {
				dispatch({ type: GAME_ACTIONS.MARK_HOT, at: interactionAt, t: input.t, interactionAt: input.interactionAt });
				if (game.spatialMap[interactionAt[0]] && game.spatialMap[interactionAt[0]][interactionAt[1]]) {
					dispatch({ type: GAME_ACTIONS.SELECT_SHIP, at: interactionAt });
				} else if (Math.abs(interactionAt[1]) == Math.floor(boardR/2)) {
					dispatch({ type: GAME_ACTIONS.SELECT_FROM_NEST, playerOrdinal: interactionAt[1] < 0 ? 1 : 0,
						nestOrdinal: Math.floor(Math.abs(interactionAt[0]/2)) });
				} else {
					for (i = 0; i < game.playSlots.length; ++i) {
						var slot = game.playSlots[i];
						if (slot[0] == interactionAt[0] && slot[1] == interactionAt[1]) {
							slotInteraction(slot, game.selectedShip);
							break;
						}
					}
				}
			} else if (interactionAt[0] == game.hotTile[0] && interactionAt[1] == game.hotTile[1]) {
				dispatch({ type: GAME_ACTIONS.MARK_COLD, t: input.t });
			}
			console.log(game.hotTile);
		}



		r.ctx.clearRect(-r.halfDim[0], -r.halfDim[1], r.dim[0], r.dim[1]);
		if (!spotlightP) {
			spotlightP = input.mAt;
		} if (game.hotTile) {
			spotlightP = game.hotTile;
		} else {
			/// TODO: make this more framerate independant
			spotlightP = addV2(spotlightP, sclV2(negV2(tileFromPixel(mAt), spotlightP), 0.25));
		}

		function drawNestBottomLayer(ctx, userOrdinal, top) {
			var c = top ? -1 : 1;
			var nest = game.playersInOrder[userOrdinal].nest;
			ctx.fillStyle = playerColormap[userOrdinal]

			var i = 1;
			for (var shipName in nest) {
				if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
				var v = centerOfTile([c*i, c*Math.floor(r.boardR/2)]);
				constructHexagon(ctx, v, tileR*1.2);
				ctx.fill();

				i += 2;
				ctx.globalAlpha = 1;
			}
		}

		drawNestBottomLayer(r.ctx, 0, false);
		drawNestBottomLayer(r.ctx, 1, true);

		r.ctx.fillStyle = "white";
		constructHexagon(r.ctx, centerOfTile(spotlightP), tileR*1.2);
		r.ctx.fill();

		r.ctx.globalCompositeOperation = "screen";
		r.ctx.globalAlpha = 0.8;
		for (var i = 0; i < game.pieces.length; ++i) {
			var ship = game.pieces[i];
			if (ship && (ship.pos[2] == 0 || ship.pos[2] == undefined)) {
				var v = centerOfTile(ship.pos);
				constructHexagon(r.ctx, v, tileR*1.2);
				r.ctx.fillStyle = playerColormap[ship.player];
				r.ctx.fill();
			}
		}
		r.ctx.globalAlpha = 1;
		r.ctx.globalCompositeOperation = "normal";

		///
		/// Render board grid
		///
		// var c1 = _b.style.color;
		// c1 = mapOver(c1.substring(4, c1.length - 1).split(', '), function(c) { return parseInt(c); });
		// var c2 = _b.style.borderColor;
		// c2 = mapOver(c2.substring(4, c2.length - 1).split(', '), function(c) { return parseInt(c); });

		var c1 = [1, 1, 1, 0.9];
		var c2 = [20, 20, 20, 1];

		fillR = tileR*(1 - 0.025); //+ 2*m[0]/w + 2*(Math.abs(orientation[2]))/90;
		constructHexagon(r.ctx, [0, 0], fillR);
		r.ctx.fillStyle = "rgba(" + mapOver(c2, Math.round).join(", ") + ")";
		r.ctx.fill();

		for (var ring = 1; ring < r.boardR / 2; ++ring) {
			var offset = sclV2(neighborOffsets[1], ring);
			var _offset = centerOfTile(offset);

			for (var j = 0; j < schafliSymbol; ++j) {
				var dOFfset = neighborOffsets[(j + 3) % schafliSymbol];
				var _t = ring/(r.boardR / 2);
				var c = [
					Math.round(lerp(c1[0], c2[0], _t*_t)),
					Math.round(lerp(c1[1], c2[1], _t*_t)),
					Math.round(lerp(c1[2], c2[2], _t*_t)),
					(lerp(c1[3], c2[3], _t*_t)),
				];
				r.ctx.fillStyle = "rgba(" + c.join(", ") + ")";
				for (var k = 0; k < ring; ++k) {

					offset = addV2(offset, dOFfset);
					_offset = centerOfTile(offset);

					r.ctx.beginPath();
					r.ctx.arc(_offset[0], _offset[1], tileA, 0, TAU);
					
					constructHexagon(r.ctx, _offset, fillR);
					r.ctx.fill();
				}
			}
		}

		var spotlightAt = tileFromPixel(mAt);
		for (i = 0; i < game.pieces.length; ++i) {
			var ship = game.pieces[i];
			var at = ship.pos;
			var v = centerOfTile(ship.pos);
			if (game.hotTile && game.hotTile[0] == at[0] && game.hotTile[1] == at[1]) {
				r.ctx.globalAlpha = smoothstep(10, 200, input.t - game.hotTileChangeT);
				r.ctx.fillStyle = playerColormap[ship.player];
				constructHexagon(r.ctx, v, fillR);
				r.ctx.fill();
				r.ctx.font = "500 " + tileA*1.3 + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
				r.ctx.fillStyle = "black";
				r.ctx.fillText(ship.type[0], v[0], v[1]);
				r.ctx.font = "500 " + tileA + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
				r.ctx.globalAlpha = 1;
			} else if (spotlightAt[0] == at[0] && spotlightAt[1] == at[1]) {
				r.ctx.fillStyle = "#061216"; //playerColormap[ship.player];
				constructHexagon(r.ctx, v, fillR);
				r.ctx.fill();
				r.ctx.fillStyle = playerColormap[ship.player];
				r.ctx.fillText(ship.type[0], v[0], v[1]);
			} else {
				r.ctx.fillStyle = playerColormap[ship.player];
				r.ctx.fillText(ship.type[0], v[0], v[1]);
			} 
		}

		for (i = 0; i < game.playSlots.length; ++i) {
			at = game.playSlots[i];
			r.ctx.globalAlpha = smoothstep(i*100, i*100 + 100, input.t - game.hotTileChangeT);
			v = centerOfTile(at);
			r.ctx.fillStyle = "rgba(255,255,255, 0.75)";
			constructHexagon(r.ctx, v, tileR*0.6);
			r.ctx.fill();


			r.ctx.textAlign = 'center';
			r.ctx.font = tileA + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
			r.ctx.textBaseline = 'middle';
			r.ctx.fillStyle = "black";
			r.ctx.fillText("+", v[0], v[1]);

		}
		r.ctx.globalAlpha = 1;




		function drawUserForeground(ctx, player, top) {
			var c = top ? -1 : 1;

			ctx.textBaseline = 'alphabetic';
			ctx.textAlign = top ? 'left' : 'right';
			ctx.font = "500 " + tileR*1.5 + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
			ctx.strokeStyle = playerColormap[player.order];
			ctx.fillStyle = playerColormap[player.order];

			ctx.lineWidth = 2;
			ctx.beginPath();

			var p0 = _h[1];
			var p1 = _h[2];
			var p2 = _h[3];
			p0 = lerpV2(p0, p1, 0.9);
			p2 = lerpV2(p1, p2, 0.3);

			p0 = sclV2(p0, 2*tileA * (1 + r.boardR)/2);
			p1 = sclV2(p1, 2*tileA * (1 + r.boardR)/2);
			p2 = sclV2(p2, 2*tileA * (1 + r.boardR)/2);
			
			ctx.moveTo(c*p0[0], c*p0[1]);
			ctx.lineTo(c*p1[0], c*p1[1]);
			ctx.lineTo(c*p2[0], c*p2[1]);
			
			ctx.stroke();
			ctx.fillText(player.username, c*(p2[0] - tileA*0.25), c*p2[1]);

			ctx.textAlign = 'center';
			ctx.font = tileA + "px 'Whitney Small-caps A', 'Whitney Small-caps B', sans-serif";
			ctx.textBaseline = 'middle';

			var x = 1;
			var nest = player.nest;
			for (i = 0; i < game.ships.length; ++i) {
				var shipName = game.ships[i];
				if (nest[shipName] == 0) ctx.globalAlpha = 0.35;
				
				v = centerOfTile([c*x, c*Math.floor(boardR/2)]);
				ctx.fillStyle = playerColormap[player.order];
				if (game.selectedShip && game.selectedShip.pos == "nest" && game.selectedShip.player == player.order && game.selectedShip.type == shipName) {
					constructHexagon(ctx, v, fillR);
					ctx.fill();
					ctx.fillStyle = 'black';
				}
				ctx.fillText(shipName[0], v[0], v[1]);

				v = centerOfTile([c*(x + 1), c*(1 + Math.floor(boardR/2))]);

				constructHexagon(ctx, v, tileR*0.6);
				ctx.fillStyle = playerColormap[player.order];
				ctx.fill();
				ctx.fillStyle = 'black';
				ctx.fillText("" + nest[shipName], v[0], v[1]);
				
				x += 2;
				ctx.globalAlpha = 1;
			}
		}

		drawUserForeground(r.ctx, game.playersInOrder[0], false);
		drawUserForeground(r.ctx, game.playersInOrder[1], true);
	}
})();