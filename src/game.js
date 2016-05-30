

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
  LOSE:            'LOSE',
  WIN:             'WIN',
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
  MARK_HOT: "MARK_HOT",
  MARK_COLD: "MARK_COLD",
  SELECT_SHIP: "SELECT_SHIP",
  SELECT_FROM_NEST: "SELECT_FROM_NEST",
  SELECT_SLOT: "SELECT_SLOT",
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


  - Check if start ship count and player order still work.

*/

var EMPTY_GAME_STATE = {
  hotTile: null,
  hotTileChangeT: 0,
  id: null,
  lastMoveCreated: 0,
  pieces: [],
  playersById: {},
  playersInOrder: [],
  playSlots: [],
  selectedShip: null,
  ships: [],
  spatialMap: { },
  startShipCount: {},
  turnCount: 0,
  turnOffset: 0,
};

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
    return EMPTY_GAME_STATE;
  }

  switch (action.type) {
    case GAME_ACTIONS.LOAD: {

      var playersById = {};
      for (var i = 0; i < action.playersInOrder.length; ++i) {
        var p = action.playersInOrder[i];
        p.order = i;
        playersById[p.id] = p
      }
      var newState = assign({}, EMPTY_GAME_STATE, {
        id: action.id,
        playersById: playersById,
        playersInOrder: action.playersInOrder,
        ships: Object.keys(action.startShipCount),
        startShipCount: action.startShipCount,
      });
      return applyMoves(newState, action.moves);
    } break;
    case GAME_ACTIONS.LOAD_MOVES: {
      var newState = assign({ }, state);
      return applyMoves(newState, action.moves);
    } break;
    case GAME_ACTIONS.MARK_HOT: {
      var newState = assign({ }, state);
      newState.hotTile = action.at;
      newState.hotTileChangeT = action.t;
      newState.playSlots = [];
      newState.selectedShip = null;

      return newState;
    } break;
    case GAME_ACTIONS.MARK_COLD: {
      return assign({}, state, { hotTile: null, selectedShip: null, hotTileChangeT: action.t, playSlots: [] });
    } break;
    case GAME_ACTIONS.SELECT_SHIP: {
      return assign({}, state, { playSlots: getMoveSlots(state.spatialMap, action.at),
        selectedShip: state.spatialMap[action.at[X]][action.at[Y]][0] });
    } break;
    case GAME_ACTIONS.SELECT_FROM_NEST: {
      var p = state.playersInOrder[action.playerOrdinal];
      return assign({}, state, { playSlots: getPutSlots(state.spatialMap, action.playerOrdinal),
      selectedShip: { pos: "nest", player: action.playerOrdinal, shipType: state.ships[action.nestOrdinal] } });
    } break;
    case GAME_ACTIONS.JOIN: {
      var newState = assign({ }, state);
      var player = state.playersById[action.playerId];
      assign(player, {
        playing: true,
        nest: assign({}, state.startShipCount)
      });

      // TODO: This is not pure.

      return newState;
    } break;
    case GAME_ACTIONS.RESIGN: {
      var newState = assign({ }, state);
      newState.playersById[action.playerId].playing = false;
      correctTurnOffset(newState);
      return newState;
    } break;


    // Note that in both MOVE and PUT, there is some array manipulation that may look a bit expensive (O(n)), but we
    // can assume that the arrays are usually very short. The most common case would be an array with just one element
    // and the absolute worst case (with some new ship types added) would probably be something like 3 per player + 1.
    case GAME_ACTIONS.MOVE: {
      var newState = assign({ }, state);
      newState.turnCount++;
      correctTurnOffset(newState);

      var tX =   action.to[X], tY =   action.to[Y];
      var fX = action.from[X], fY = action.from[Y];
      var newMap = assign({}, newState.spatialMap);
      if (!newMap[fX] || !newMap[fX][fY] || !newMap[fX][fY].length)
        invalidCodePath();


      var ship = assign({}, newMap[fX][fY][0], { pos: action.to });
      newState.pieces[ship.ordinal] = ship;

      var shipStack = [ship];
      newMap[tX] = assign({}, newMap[tX]);
      newMap[fX][fY] = newMap[fX][fY].slice(1);
      if (newMap[tX][tY]) shipStack = shipStack.concat(newMap[tX][tY]);
      newMap[tX][tY] = shipStack;
      if (!newMap[fX][fY].length) delete newMap[fX][fY];
      if (!Object.keys(newMap[fX]).length) delete newMap[fX];

      newState.spatialMap = newMap;
      return newState;
    } break;
    case GAME_ACTIONS.PUT: {
      var newState = assign({ }, state);
      var player = getCurrentPlayer(newState);
      player.nest[action.shipType]--;

      newState.turnCount++;
      correctTurnOffset(newState);

      var tX = action.to[X], tY = action.to[Y];
      var piece = { player: player.order, type: action.shipType, pos: action.to, ordinal: newState.pieces.length };
      newState.pieces = newState.pieces.concat([piece]);

      var newMap = assign({}, newState.spatialMap);
      var column = assign({}, newMap[tX]);
      var cell = column[tY];
      cell = cell ? [piece].concat(cell) : [piece];

      column[tY] = cell;
      newMap[tX] = column;
      newState.spatialMap = newMap;

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

function slotInteraction(at, sel) {
  var gameState = gameStore.getState();
  var currentPlayer = getCurrentPlayer(gameState);
  var session = globalStore.getState().session;
  // var sel = gameState.selectedShip;
  var selPlayer = gameState.playersById[sel.player];
  var gameId = gameState.id;
  if (sel.player == currentPlayer.order &&
    session.user.id == currentPlayer.id) {

    gameStore.dispatch({ type: GAME_ACTIONS.MARK_COLD });
    
    gameStore.dispatch(function(dispatch){
      /*
      We optimistically update the board immediately. If it turns out 
      storing the board failed, we just reload the latest known state.
      */
      var payload;
      if (sel.pos == 'nest') {
        payload = {
          type: createPutType(sel.shipType),
          to: at,
        }
        dispatch({
          type: GAME_ACTIONS.PUT,
          to: at,
          shipType: sel.shipType
        });
      } else if (sel.pos) {
        payload = {
          type: MOVES.MOVE,
          from: sel.pos,
          to: at
        }; 
        dispatch({
          type: GAME_ACTIONS.MOVE,
          from: sel.pos,
          to: at
        });
      } else { invalidCodePath(); return; }

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
}