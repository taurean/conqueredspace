function addV2(p1, p2) { return [ p1[0] + p2[0], p1[1] + p2[1] ]; }


///
/// Game code
///

var SHIPS = {
  MOTHERSHIP: 'MOTHERSHIP', // bee
  SCOUT: 'SCOUT',           // ant
  SHIFTER: 'SHIFTER',       // musquito
  HOPPER: 'HOPPER',         // grasshopper
  CRAWLER: 'CRAWLER',       // beetle
  SPIDER: 'SPIDER'
};
var shipLabels = {
    MOTHERSHIP: "Mothership",
    SCOUT:      "Scout",
    SHIFTER:    "Shifter",
    HOPPER:     "Hopper",
    CRAWLER:    "Crawler",
    SPIDER:     "Spider"
};

var MOVES = {
  JOIN:            'JOIN',
  RESIGN:          'RESIGN',
  MOVE:            'MOVE',
  PLAY_MOTHERSHIP: 'PLAY_MOTHERSHIP',
  PLAY_SCOUT:      'PLAY_SCOUT',
  PLAY_SHIFTER:    'PLAY_SHIFTER',
  PLAY_HOPPER:     'PLAY_HOPPER',
  PLAY_CRAWLER:    'PLAY_CRAWLER',
  PLAY_SPIDER:     'PLAY_SPIDER',
}
function shipFromMove(m) {
    assert(m.substr(0, 5) == "PLAY_");
    return m.substr(5);
}
function createPutType(shipType) { return 'PLAY_' + shipType; };

var players = [ 'white', 'black' ];
var neighborOffsets = [
  [ -1, -1 ], // top left
  [  0, -1 ], // top right
  [  1,  0 ], // right
  [  1,  1 ], // bottom right
  [  0,  1 ], // bottom left
  [ -1,  0 ], // left
];


/// Game state management

var GAME_ACTIONS = {
  LOAD:       "LOAD",
  LOAD_MOVES: "LOAD_MOVES",
  SELECT_TILE: "SELECT_TILE",
  DESELECT_TILE: "DESELECT_TILE",
  JOIN:       "JOIN",
  RESIGN:     "RESIGN",
  MOVE:       "MOVE",
  PUT:        "PUT",
  PASS:       "PASS",
};

/*
TODO:
  - move all the game state manipulation to here (accept game request)
  - implement the game state changes that are left
    - store move
    - resign

*/
function gameReduxer(state, action) {
  function applyMoves(state, moves) {
    var newState = assign({}, state);
    newState.lastMoveCreated = peek(action.moves).created;
    for (var i = 0; i < moves.length; ++i) {
      var m = moves[i];
      switch(m.type) {
        case MOVES.JOIN:
          newState = gameReduxer(newState,
            { type: GAME_ACTIONS.JOIN, playerId: m.playerId });
          break;
        case MOVES.RESIGN:
          newState = gameReduxer(newState,
            { type: GAME_ACTIONS.RESIGN, playerId: m.playerId });
          break;
        case MOVES.PASS:
          newState = gameReduxer(newState,
            { type: GAME_ACTIONS.PASS });
          break;
        case MOVES.MOVE:
          newState = gameReduxer(newState,
            { type: GAME_ACTIONS.MOVE, from: m.from, to: m.to });
          break;
        case MOVES.PLAY_MOTHERSHIP:
        case MOVES.PLAY_SCOUT:
        case MOVES.PLAY_SHIFTER:
        case MOVES.PLAY_HOPPER:
        case MOVES.PLAY_CRAWLER:
        case MOVES.PLAY_SPIDER:
          var shipType = m.type.substr(5);
          newState = gameReduxer(newState, {
            type: GAME_ACTIONS.PUT,
            shipType: shipType,
            to: m.to
          });
          break;
      }
    }
    return newState;
  }

  if (typeof state == 'undefined') {
    return {
      id: null,
      turnCount: 0,
      turnOffset: 0,
      spatialMap: { },
      pieces: [],
      playersById: {},
      playersInOrder: [],
      selected: null,
      lastMoveCreated: 0
    };
  }

  switch (action.type) {
    case GAME_ACTIONS.LOAD: {
      var newState = {
        id: action.id,
        turnCount: 0,
        turnOffset: 0,
        spatialMap: { },
        pieces: [],
        playersById: action.playersById,
        playersInOrder: [],
        selected: null,
        lastMoveCreated: 0
      };
      return applyMoves(newState, action.moves);
    } break;
    case GAME_ACTIONS.LOAD_MOVES: {
      var newState = assign({ }, state);
      return applyMoves(newState, action.moves);
    } break;
    case GAME_ACTIONS.SELECT_TILE: {
      var newState = assign({ }, state);
      newState.selected = {
        on: action.on,
        shipType: action.shipType,
        player: action.player,
        x: action.x,
        y: action.y,
        z: action.z,
      };
      return newState;
    } break;
    case GAME_ACTIONS.DESELECT_TILE: {
      return assign({}, state, { selected: null });
    }
    case GAME_ACTIONS.JOIN: {
      var newState = assign({ }, state);
      var player = state.playersById[action.playerId];
      assign(player, {
        order: newState.playersInOrder.length,
        playing: true,
        nest: {
          MOTHERSHIP: 1,
          SCOUT:      3,
          SHIFTER:    2,
          HOPPER:     3,
          CRAWLER:    3,
          SPIDER:     2
        }
      });

      newState.playersInOrder.push(player);
      return newState;
    } break;
    case GAME_ACTIONS.RESIGN: {
      var newState = assign({ }, state);
      newState.playersById[action.playerId].playing = false;
      correctTurnOffset(newState);
      return newState;
    } break;
    case GAME_ACTIONS.MOVE: {
      var newState = assign({ }, state);
      newState.turnCount++;
      correctTurnOffset(newState);
      movePiece(newState, action.from, action.to);
      return newState;
    } break;
    case GAME_ACTIONS.PUT: {
      var newState = assign({ }, state);
      var player = getCurrentPlayer(newState);
      player.nest[action.shipType]--;
      putPiece(newState, action.to, action.shipType, player.order);

      newState.turnCount++;
      correctTurnOffset(newState);
      return newState;
    } break;
    case GAME_ACTIONS.PASS: {
      var newState = assign({ }, state);
      newState.turnCount++;
      correctTurnOffset(newState);
      return newState;
    } break;
    default: {
      return state;
    }
  }
}

function putPiece(game, to, shipType, player) {
  var piece = { player: player, type: shipType, pos: to };
  game.pieces.push(piece);
  if (!game.spatialMap[to[0]]) game.spatialMap[to[0]] = { };
  if (!game.spatialMap[to[0]][to[1]]) game.spatialMap[to[0]][to[1]] = [ ];
  game.spatialMap[to[0]][to[1]].unshift(piece);
}
function movePiece(game, from, to) {
  if (!game.spatialMap[from[0]] || !game.spatialMap[from[0]][from[1]] || !game.spatialMap[from[0]][from[1]].length) return;
  if (!game.spatialMap[to[0]]) game.spatialMap[to[0]] = { };
  if (!game.spatialMap[to[0]][to[1]]) game.spatialMap[to[0]][to[1]] = [ ];
  game.spatialMap[to[0]][to[1]].unshift(game.spatialMap[from[0]][from[1]].shift());
  game.spatialMap[to[0]][to[1]][0].pos = to;
  if (!game.spatialMap[from[0]][from[1]].length) delete game.spatialMap[from[0]][from[1]];
  if (!Object.keys(game.spatialMap[from[0]]).length) delete game.spatialMap[from[0]];
}

function correctTurnOffset(game) {
  var playerCount = game.playersInOrder.length;
  while(! getCurrentPlayer(game).playing)
    game.turnOffset++;
}
function getCurrentPlayer(game) {
  return game.playersInOrder[(game.turnCount + game.turnOffset) % game.playersInOrder.length];
}

function encodeCoords(x, y) { return x + ',' + y; }
function getTile(hive, from) { return hive[from[0]] && hive[from[0]][from[1]]; }
function getNeighbors(hive, from) {
  return neighborOffsets.map(function(offset) {
    return getTile(hive, addV2(offset, from));
  });
}
function getMoveSlots(hive, from) {
  var neighbors = getNeighbors(hive, from);
  var tile = getTile(hive, from);
  var piece = tile && tile[0];
  var moveSlots = [];
  var i, neighbor, markedTiles = { };

  markedTiles[from.toString()] = true;

  function breaksHive() {
    var breaks = false;
    if (tile.length == 1) {
      var markedTiles = {}
      markedTiles[from.toString()] = true;
      function markTiles(from) {
        markedTiles[from.toString()] = true;
        for (var i in neighborOffsets) {
          var pos = addV2(from, neighborOffsets[i]);
          if (!markedTiles[pos.toString()] && getTile(hive, pos))
            markTiles(pos);
        }
      }
      var hasMarked = false;
      for (var i in neighborOffsets) {
        var pos = addV2(from, neighborOffsets[i]);
        if (getTile(hive, pos)) {
          if (!hasMarked) {
            markTiles(pos);
            hasMarked = true;
          } else if (!markedTiles[pos.toString()])
            breaks = true;
        }
      }
    }

    return breaks;
  }

  function countNeighbors(hive, from) {
    return neighborOffsets.reduce(function(count, offset) {
      var pos = addV2(offset, from);
      return (!markedTiles[pos.toString()] && getTile(hive, pos)) ? count + 1 : count;
    }, 0);
  }
  function getLegalShoves(from) {
    var legalShoves = [];
    for (var i = 0,
        prev = addV2(from, neighborOffsets[5]),
        curr = addV2(from, neighborOffsets[0]),
        next = addV2(from, neighborOffsets[1]);
        i < 6;
        ++i,
        prev = curr,
        curr = next,
        next = addV2(from, neighborOffsets[(i + 1)%6])) {
      if (!markedTiles[curr.toString()] &&
          !getTile(hive, curr) &&
          (!getTile(hive, prev) || !getTile(hive, next)) &&
          countNeighbors(hive, curr)) {
        legalShoves.push(curr);
      }
    }

    return legalShoves;
  }

  if (!breaksHive(hive, from)) {
    switch(piece.type) {
      case SHIPS.MOTHERSHIP: {
        moveSlots = getLegalShoves(from);
      } break;
      case SHIPS.SCOUT: {
        moveSlots = getLegalShoves(from);
        for(i = 0; i < moveSlots.length; ++i) {
          var pos = moveSlots[i];
          markedTiles[pos.toString()] = true;
          Array.prototype.push.apply(moveSlots, getLegalShoves(pos));
        }
      } break;
      case SHIPS.SPIDER: {
        var searchStack = getLegalShoves(from);
        searchStack.forEach(pos => markedTiles[pos.toString()] = true);
        searchStack = Array.prototype.concat.apply([], searchStack.map(getLegalShoves));
        searchStack.forEach(pos => markedTiles[pos.toString()] = true);
        moveSlots = Array.prototype.concat.apply([], searchStack.map(getLegalShoves));
      } break;
      case SHIPS.HOPPER: {
        moveSlots = neighborOffsets
          .filter(offset => getTile(hive, addV2(offset, from)))
          .map(function(offset) {
            var pos = addV2(from, offset);
            while(getTile(hive, pos)) pos = addV2(pos, offset);

            return pos;
          });
      } break;
      case SHIPS.CRAWLER: {
        moveSlots = neighborOffsets.map(addV2.bind(window, from));
      } break;
    }
  }

  return moveSlots;
}
function getPutSlots(hive, player) {
  var slots = [];
  if (Object.keys(hive).length == 0) {
    slots.push([0, 0]);
  } else {
    var occupied = 1;
    var attacked = 2;
    var reachable = 4;
    var hasTiles = false;
    var tileMarks = { };
    for (var x in hive) {
      for (var y in hive[x]) {
        tileMarks[encodeCoords(+x, +y)] |= occupied;
        if (hive[x][y][0].player == player) {
            hasTiles = true;
            neighborOffsets.forEach(function(offset) {
              var serialCoords = encodeCoords(+x + offset[0], +y + offset[1]);
              tileMarks[serialCoords] |= reachable;
            });
        } else {
            neighborOffsets.forEach(function(offset) {
              var serialCoords = encodeCoords(+x + offset[0], +y + offset[1]);
              tileMarks[serialCoords] |= attacked;
            });
        }
      }
    }
  }

  var mask = occupied;
  if (hasTiles) mask |= attacked;
  for (var serialCoords in tileMarks) {
    if (! (tileMarks[serialCoords] & mask))
      slots.push(serialCoords.split(','));
  }
  return slots;
}

///
/// React based rendering
///

var pieceR = 25;
var strideR = pieceR + 1;
function boardSpaceToRenderSpace(pos) {
  return [pos[0]*strideR - 0.5*pos[1]*strideR, pos[1]*strideR];
}
/*
generating the outlines with:


var pieceOutline = [];
var pieceInline = [];
(function(){
for (var i = 0; i < 6; ++i) {
  var a = ((i + 0.5)/6)*2*Math.PI;
  pieceOutline.push(Math.cos(a)*pieceR/2);
  pieceOutline.push(Math.sin(a)*pieceR/2);
  pieceInline.push(Math.cos(a)*(pieceR - pieceR/3)/2);
  pieceInline.push(Math.sin(a)*(pieceR - pieceR/3)/2);
}})();
*/

var pieceOutline = [10.825317547305485, 6.25, 0, 12.5, -10.825317547305485, 6.25, -10.825317547305483, -6.25, 0, -12.5, 10.82531754730548, -6.25].join(',')
var pieceInline = [7.216878364870322, 4.166666666666665, 0, 8.333333333333332, -7.216878364870322, 4.166666666666665, -7.216878364870321, -4.166666666666667, 0, -8.333333333333332, 7.216878364870319, -4.16666666666667].join(',');
var Tile = React.createClass({
  render: function() {
    var props = this.props;
    var className = format("piece piece--z$1", props.z);
    var selectedTile = gameStore.getState().selected;
    if (selectedTile && selectedTile.on == props.on &&
      selectedTile.x == props.x && 
      selectedTile.y == props.y && 
      selectedTile.z == props.z) {
      className += " piece--selected";
    }
    var transform = format("translate($1)",
      boardSpaceToRenderSpace([parseInt(props.x), parseInt(props.y)]).join(','));

    return (<g onClick={props.onClick} className={className}
      data-type={props.type} data-player={props.player} data-on={props.on}
      data-x={props.x} data-y={props.y} data-z={props.z} transform={transform}
      ><polygon points={pieceOutline} className="piece_poly--outer"
      /><polygon points={pieceInline} className="piece_poly piece_poly--inner" /></g>);
  }
});
var ActionTile = React.createClass({
  render: function() {
    return (<a id="svg-action-template" className="piece piece--action"
      ><polygon points={pieceOutline} className="piece_poly--outer"
      /><polygon points={pieceInline} className="piece_poly piece_poly--inner"/></a>);
  }
});
var PutSlot = React.createClass({
  render: function() {
    var props = this.props;
    var transform = format("translate($1)",
      boardSpaceToRenderSpace([parseInt(props.x), parseInt(props.y)]).join(','));
    return (
      <g className="putSlot" onClick={props.onClick} transform={transform}
        data-player={props.player} data-x={props.x} data-y={props.y}
        ><polygon points={pieceInline} className="piece_poly--outer"
        /><text><tspan text-anchor="middle">+</tspan></text></g>);
  }
});
var MoveSlot = React.createClass({
  render: function() {
    var props = this.props;
    var transform = format("translate($1)",
      boardSpaceToRenderSpace([parseInt(props.x), parseInt(props.y)]).join(','));
    return (
      <g id="svg-move-template" className="moveSlot" transform={transform}
        ><polygon points={pieceInline} className="piece_poly--outer"
        /><text><tspan text-anchor="middle">o</tspan></text></g>);
  }
});
var GameBoard = React.createClass({
  getInitialState: function() {
    return {
      slotSelected: null
    };
  },
  componentWillMount: function() {

  },
  componentWillUnmount: function() {

  },
  onClickTile: function(e) {
    var t = e.currentTarget;
    gameStore.dispatch({
      type: GAME_ACTIONS.SELECT_TILE,
      on: "board",
      shipType: t.getAttribute('data-type'),
      player: t.getAttribute('data-player'),
      x: t.getAttribute('data-x'),
      y: t.getAttribute('data-y'),
      z: t.getAttribute('data-z'),
    });
    console.log('clicked a tile', arguments);
  },
  onClickNestTile: function(e) {
    console.log('clicked a tile in the nest', arguments);
    var t = e.currentTarget;
    gameStore.dispatch({
      type: GAME_ACTIONS.SELECT_TILE,
      on: "nest",
      shipType: t.getAttribute('data-type'),
      player: t.getAttribute('data-player'),
      x: t.getAttribute('data-x'),
      y: t.getAttribute('data-y'),
      z: t.getAttribute('data-z'),
    });
  },
  onClickSlot: function(e) {
    var currentPlayer = getCurrentPlayer(this.props);
    var session = globalStore.getState().session;
    var t = e.currentTarget;
    var sel = this.props.selected;
    var selPlayer = this.props.playersById[sel.player];
    var gameId = this.props.id;
    if (sel.player == currentPlayer.order &&
      session.user.id == currentPlayer.id) {

      gameStore.dispatch({ type: GAME_ACTIONS.DESELECT_TILE });
      
      var to = [parseInt(t.getAttribute('data-x')),
        parseInt(t.getAttribute('data-y'))];
      gameStore.dispatch(function(dispatch){
        /*
        We optimistically update the board immediately. If it turns out 
        storing the board failed, we just reload the latest known state.
        */
        var payload;
        if (sel.on == 'board') {
          payload = {
            type: MOVES.MOVE,
            from: [sel.x, sel.y],
            to: to
          }; 
          dispatch({
            type: GAME_ACTIONS.MOVE,
            from: [parseInt(sel.x), parseInt(sel.y)],
            to: to
          });
        } else if (sel.on == 'nest') {
          payload = {
            type: createPutType(sel.shipType),
            to: to,
          }
          dispatch({
            type: GAME_ACTIONS.PUT,
            to: to,
            shipType: sel.shipType
          });
        } else { invalidCodePath(); }

        POST(urls.gameMoves(gameId), payload, function(status, data) {
          if (statusOK(status)) {
            console.log('last move confirmed.');
          } else {
            console.error('Could not store new move', payload, data);
            dispatch({
              type: ACTIONS.INVALIDATE_GAME_VIEW,
              error: data
            });
          }
        }, authHeader(globalStore.getState()));
      });
    }
  },
  onClickBoard: function() {
    console.log('clicked the board', arguments);
  },
  renderNest: function(remainingPieces, player) {
    var pieces = [];
    var i = 0;
    for (var t in remainingPieces) {
      var count = remainingPieces[t]
      if (count) {
        while (count--) {
          pieces.push(<Tile on="nest" onClick={this.onClickNestTile} player={player} 
            type={t} x={i} y="0" z="0" />);
          i++;
        }
      }
    }
    pieces.unshift(
      <rect className="nest-background" width={i * (pieceR + 1)}
        transform={format("translate(-$1,-$1)", pieceR/2)} />);
    return pieces;
  },
  render: function() {
    var self = this;
    var props = this.props;
    var slotClass = "slot slot--" + props.actionType;
    var currentPlayer = getCurrentPlayer(props);
    var p1NestClasses = "nest nest--p1";
    var p2NestClasses = "nest nest--p2";
    if (currentPlayer == props.playersInOrder[0]) {
      p1NestClasses += " nest--activePlayer";
    } else {
      p2NestClasses += " nest--activePlayer";
    }

    var slots = [];
    if (props.selected) {
      var sel = props.selected;
      if (sel.on == "board") {
        slots = getMoveSlots(props.spatialMap, [parseInt(sel.x), parseInt(sel.y)]);
      } else if (sel.on == "nest") {
        slots = getPutSlots(props.spatialMap, sel.player);
      } else {
        invalidCodePath();
      }
      console.log('selected', sel, slots);
    }

    return (<svg className="gameBoard" xmlns="http://www.w3.org/2000/svg" width="500px" height="500px" viewBox="-250 -250 500 500" version="1.1">
        <g className="board">
          {props.pieces.map(function(insect) {
            var stack = props.spatialMap[insect.pos[0]][insect.pos[1]];
            var z = 0;
            while (stack[z] && stack[z] != insect) z++;

            return (<Tile onClick={self.onClickTile}
                          player={insect.player}
                          on="board"
                          type={insect.type}
                          x={insect.pos[0]} y={insect.pos[1]} z={z} />);
          })}
          {slots.map(function(pos) {
            return <PutSlot onClick={self.onClickSlot} x={pos[0]} y={pos[1]} />
          })}
        </g>
        <g className={p1NestClasses} transform="translate(-100, -220)">
          {this.renderNest(props.playersInOrder[0].nest, 0)}
        </g>
        <g className={p2NestClasses} transform="translate(-100, 220)">
          {this.renderNest(props.playersInOrder[1].nest, 1)}
        </g>
      </svg>);
  }
});