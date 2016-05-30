
var roles = {
  user: 1 << 0,
  admin: 1 << 1,
}

function authHeader(state) {
  return { Authorization: 'BEARER ' + state.session.tokenString};
}
function authPayload(state) {
  return { access_token: state.session.tokenString };
}


/// trie impl
function trieInsert(node, k, v, d) {
  if (typeof d == 'undefined') d = 0;
  assert(d < k.length);
  if (! (k[d] in node.children)) {
    node.children[k[d]] = { children: { } };
  }
  if (k.length - 1 == d) {
    node.children[k[d]].value = v;
  } else {
    trieInsert(node.children[k[d]], k, v, d + 1);
  }
}
function _trieGetNode(node, k, d) {
  if (typeof d == 'undefined') d = 0;
  assert(d < k.length);

  if (k.length - 1 == d) { return node; }
  else {
    var next = node.children[k[d]];
    if (next) return _trieGetNode(next, k, d + 1);
    else return undefined;
  }
}

function trieLookup(node, k) {
  var n = _trieGetNode(node, k, 0);
  if (n) return n.value;
  else return undefined;
}
function trieDelete(node, k) {
  var n = _trieGetNode(node, k, 0);
  if (n) delete n.value;
}

function trieWalkKeys(node, prefix) {
  if (typeof prefix == 'undefined') prefix = '';

  var aggregate = [];
  for (var c in node.children) {
    aggregate = aggregate.concat(trieWalk(node.children[c], prefix + c));
  }
  return aggregate;
}


var urls = {
  users: BASE_URL + 'users',
  userGames: (uid => [urls.users, uid, 'games'].join('/')),

  alphaCodes: BASE_URL + 'alpha-codes',

  games: BASE_URL + 'games',
  gameMoves: (gid => [urls.games, gid, 'moves'].join('/')),
  gamePlayer: ((uid, gid) => [urls.games, gid, 'players', uid].join('/')),
  sessions: BASE_URL + 'sessions'
};


///
/// State management
///

// A small implementation of the redux library.
// I haven't bought into the concept fully yet, but this way I can try it.
// It also has some functionality to work with async workflows built in, which would otherwhise need middle ware (read; more bloat)
function createStore(reduxer) {
  var subscribers = [];
  var state;
  function unsubscribe(fn) {
    subscribers = subscribers.filter(function(f) { return f !== fn });
  }
  var store = {
    getState: function() { return state },
    dispatch: function(action) {
      if (typeof action == "function") {
        action(store.dispatch);
      } else {
        state = reduxer(state, action);
      }
      subscribers.forEach(function(subscriber) { subscriber(state, store.dispatch, action); });
    },
    subscribe: function(fn) {
      subscribers.push(fn);
      return unsubscribe.bind(fn);
    }
  };

  store.dispatch({});
  return store;
}


var ACTIONS = {
  REPLY_GAME_REQUEST: "REPLY_GAME_REQUEST",
  REPLY_GAME_REQUEST_FAILED: "REPLY_GAME_REQUEST_FAILED",

  INVALIDATE_GAME_VIEW: 'INVALIDATE_GAME_VIEW',
  ROUTE: "ROUTE",
  RUN_POLLING: "RUN_POLLING",
  POLL: "POLL",
  POLL_SUCCESS: "POLL_SUCCESS",
  POLL_FAILED: "POLL_FAILED",
  POLLING_STOPPED: "POLLING_STOPPED",
  LOG_OUT: "LOG_OUT",
  LOGGING_IN: "LOGGING_IN",
  LOG_IN_SUCCESFUL: "LOG_IN_SUCCESFUL",
  LOG_IN_FAILED: "LOG_IN_FAILED",
  MAKE_MOVE: "MAKE_MOVE",
  MOVE_FAILED: "MOVE_FAILED",
};

var initialState = {
  route: {
    path: '/',
    name: '/',
    params: []
  },
  pollStatus: {
    running: false,
    lastPoll: null,
    polling: false,
    errors: [],
  },
  session: {
    loading: false,
    tokenString: null,
    user: null,
    expiration: 0,
    id: null,
    username: null,
    roles: 0,
    errors: []
  },
  errors: [],
  users: {},
  userLookup: { children: {} },
  games: {},
  gameView: gameReduxer(undefined, null)
};
function rootReduxer(state, action) {
  if(typeof state == "undefined") {
    return initialState;
  }

  assert(typeof action.type !== "undefined");

  console.log("changing state with action", action);

  switch(action.type) {
  case ACTIONS.ROUTE:
    var newState = assign({}, state);
    newState.route = {
      path: action.path,
      name: action.name,
      params: action.params
    };
    return newState;

  case ACTIONS.RUN_POLLING:
    var newState = assign({}, state);
    newState.pollStatus.running = true;
    return newState;

  case ACTIONS.POLL:
    var newState = assign({}, state);
    newState.pollStatus.polling = true;
    return newState;

  case ACTIONS.POLL_SUCCESS:
    var newState = assign({}, state);
    newState.pollStatus.polling = false;
    newState.pollStatus.lastPoll = action.timestamp;
    newState.pollStatus.errors = [];

    /// NOTE: How do we deal with local versions -- if that is even a thing?

    // normalize the data so it becomes easier to cross reference things later
    var k, o;
    for (k in action.games) {
      o = action.games[k]
      for (var kk in o.playersInOrder) {
        var p = o.playersInOrder[kk];
        trieInsert(newState.userLookup, p.username, p.id);
        o.playersInOrder[kk] = p.id;
        newState.users[p.id] = p;
      }
      newState.games[o.id] = o;
    }

    newState.session = assign({}, newState.session, {
      user: action.user,
      gameIds: mapOver(action.games, function(g) { return g.id; }),
    });
    return newState;

  case ACTIONS.POLL_FAILED:
    var newState = assign({}, state);
    newState.pollStatus.polling = false;
    newState.pollStatus.errors = action.errors;
    return newState;

  case ACTIONS.POLLING_STOPPED:
    var newState = assign({}, state);
    newState.pollStatus = assign({}, state.pollStatus, { polling: false });
    return newState;

  case ACTIONS.LOG_OUT:
    var newState = assign({}, initialState);
    return newState;
  case ACTIONS.LOGGING_IN:
    var newState = assign({}, state);
    newState.session = assign({}, state.session, { loading: true});
    return newState;
  case ACTIONS.LOG_IN_SUCCESFUL:
    var newState = assign({}, state);
    newState.session = assign({}, newState.session, {
      loading: false,
      tokenString: action.session.tokenString,
      userId: action.session.data.uid,
      username: action.session.data.sub,
      roles: action.session.data.roles,
      expiration: action.session.data.exp,
      errors: []
    });
    return newState;
  case ACTIONS.LOG_IN_FAILED:
    var newState = assign({}, state);
    newState.session = assign({}, newState.session, initialState.session);
    newState.session.error = action.error;
    return newState;

  case ACTIONS.REPLY_GAME_REQUEST:
    // this is an optimistic action.
    var newState = assign({}, state);
    var moveType = action.moveType;
    newState.games[action.gameId].moves.push({
      type: moveType, playerId: newState.session.user.id });

    return newState;

  case ACTIONS.REPLY_GAME_REQUEST_FAILED:
  case ACTIONS.MOVE_FAILED:
    var newState = assign({}, state);
    newState.errors.push(action.error);
    return state;

  case ACTIONS.INVALIDATE_GAME_VIEW:
    var newState = assign({}, state);
    newState.errors.push(action.error);
    newState.gameView.id = null;
    return newState;

  default:
    var newState = assign({}, state);
    newState.gameView = gameReduxer(state.gameView, action);
    return newState;
  }
}


///
/// Session management
///

/// NOTE(): checking the user id should not be neccesary, but I don't think it is harmful..
function isSessionValid(session) { return session && session.userId !== null && getNow() < session.expiration; }
function _logIn(store, token) {
  var session = sessionFromToken(token);
  store.dispatch({
    type: ACTIONS.LOG_IN_SUCCESFUL,
    session: session
  });
  window.localStorage.setItem('sessionToken', JSON.stringify(session));
}
function logIn(store, username, password, keep) {
  if (store.getState().session.loading) {
    console.warn('Trying to log in, but previous request is not done');
    return;
  }
  store.dispatch(function(dispatcher) {
    dispatcher({ type: ACTIONS.LOGGING_IN });

    POST(urls.sessions, { username: username, password: password }, (status, data) => {
      if (statusOK(status)) {
        _logIn(store, data);
      } else {
        dispatcher({
          type: ACTIONS.LOG_IN_FAILED,
          error: { code: status, message: data }
        });
      }
    });
  });
}
function logOut(store) {
  window.localStorage.setItem('sessionToken', '')
  store.dispatch({ type: ACTIONS.LOG_OUT });
}
function refreshSession(store) {
  var token = store.getState().session.sessionToken;
  POST(urls.sessions, { access_token: token }, function(status, data) {
    if (statusOK(status)) { _logIn(store, data) }
    else                  { logOut(store); }
  });
}
function restoreSession(store) {
  var session;
  var token = window.localStorage.getItem('sessionToken');
  try {
    if (token) { session = JSON.parse(token); }
  } catch(e) { console.err(e); return; }
  var ok = session && getNow() < session.data.exp;
  if (ok) {
    store.dispatch({
      type: ACTIONS.LOG_IN_SUCCESFUL,
      session: session
    });
  }

  return ok;
}


///
/// Polling
///

var pollRequestHandle = null;
var pollIntervalHandle = null;
function poll() {
  var state = globalStore.getState();
  if (state.pollStatus.polling) {
    console.error("Trying to poll but poller is busy..");
    return;
  }
  if (! isSessionValid(state.session)) {
    console.error("Trying to poll, but the session is not valid.");
    return;
  }

  globalStore.dispatch({ type: ACTIONS.POLL });
  /// NOTE(): It'd be super cool to get some delta system working, to reduce the bandwidth load.
  GET(urls.users + '/' + state.session.userId,
    { filter: 'dashboard' },
    function(status, data) {
      if (statusOK(status)) {
        try {
          var dashboardData = JSON.parse(data);
        } catch(e) {
          console.warn("could not parse dashboard data: ", e, data);
          return;
        }
        globalStore.dispatch(assign(dashboardData, { type: ACTIONS.POLL_SUCCESS }));
      } else {
        globalStore.dispatch({
          type: ACTIONS.POLL_FAILED,
          errors: data
        });

        if (status == 404 || status == 401) logOut(globalStore);
      }
    },
    authHeader(state)
  );
}
function initPollSystem(store) {
  store.subscribe(function(state, dispatch, action) {
    switch(action.type) {
    case ACTIONS.LOG_IN_SUCCESFUL: {
      //assert(pollIntervalHandle === null);
      if (pollIntervalHandle !== null) {
        clearInterval(pollIntervalHandle);
        console.warn("starting poll while there was an active poll interval");
      }

      dispatch({ type: ACTIONS.RUN_POLLING });
      pollIntervalHandle = setInterval(poll, POLL_DT);

      poll();
    } break;

    case ACTIONS.LOG_OUT: {
      dispatch({ type: ACTIONS.POLLING_STOPPED });
      if (pollIntervalHandle) {
        clearInterval(pollIntervalHandle);
      }
    } break;
    }
  });
}


///
/// SOMETHING
///


function requestGame(store, invitee) {
  var session = store.getState().session;
  if (typeof invitee != "undefined") {
    var dest = urls.userGames(session.userId);
    POST(dest, { invitees: invitee, access_token: session.tokenString }, function() {
      console.log("game request against " + invitee + " posted with results:", arguments )
    });
  } else {
    /// TODO: support for random opponents
  }
}

function acceptOrRejectRequest(store, gameId, accept) {
  var moveType = accept ? MOVES.JOIN : MOVES.RESIGN;
  var self = this;

  store.dispatch({
    type: ACTIONS.REPLY_GAME_REQUEST,
    moveType: moveType,
    gameId: gameId
  });
  var state = store.getState();

  POST(urls.gameMoves(gameId), {
      type: moveType,
      access_token: state.session.tokenString
    }, function(status, data){
      if (!statusOK(status)) {
        store.dispatch({
          type: ACTIONS.REPLY_GAME_REQUEST_FAILED,
          gameId: gameId,
          error: data
        });
      }
    });
}
function acceptGameRequest(store, gameId) { acceptOrRejectRequest(store, gameId, true); }
function rejectGameRequest(store, gameId) { acceptOrRejectRequest(store, gameId, false); }


///
/// Routing
///

var gameStore = createStore(gameReduxer);

var GameView = React.createClass({
  getInitialState: function() {
    return { counter: 0 };
  },
  loopHandle: null,
  toggleRendering: function(el) {
    if (this.loopHandle) {
      this.loopHandle();
      this.loopHandle = noop;
    }
    if (el) {
      var r = initGameRenderer(el);
      this.loopHandle = startLoop(function(input) {
        renderAndUpdateGame(r, input, gameStore.getState(), gameStore.dispatch);
      });
    }
  },
  componentWillMount: function(){
    var self = this;
    function updateViewStore(appState, viewStore) {
      var id = self.props.id;
      var gameData = appState.games[id];
      if (!gameData) return;

      var viewState = viewStore.getState();
      if (viewState.id != id || viewState.lastMoveCreated < peek(gameData.moves).created) {
        var playerCount = gameData.playersInOrder.length;
        var playersInOrder = Array(playerCount);
        for (var i = 0; i < playerCount; ++i) {
          var pid = gameData.playersInOrder[i];
          playersInOrder[i] = assign({}, appState.users[pid])
        }
        viewStore.dispatch({
          type: GAME_ACTIONS.LOAD,
          id: id,
          moves: gameData.moves,
          startShipCount: gameData.startShipCount,
          playersInOrder: playersInOrder
        });
        // } else if (gameView.lastMoveCreated < peek(data.moves).created) {
        //   var newMoves = [];
        //   for (var i = 0; i < data.moves.length; ++i) {
        //     if (gameView.lastMoveCreated < data.moves[i].created)
        //       newMoves.push(data.moves[i]);
        //   }
        //   globalStore.dispatch({
        //     type: GAME_ACTIONS.LOAD_MOVES,
        //     moves: newMoves
        //   });
      }
    }

    this.updateCBHandle = globalStore.subscribe(function(state, dispatch, action) {
      updateViewStore(state, self.props.store);
    });
    updateViewStore(globalStore.getState(), self.props.store);
  },
  componentWillUnmount: function() {
    if (this.updateCBHandle) this.updateCBHandle();
    if (this.redrawHandle) this.redrawHandle();
  },
  render: function() {
    return (<div>
        <canvas ref={this.toggleRendering} />
      </div>);
  }
});

var DashboardView = React.createClass({
  requestGame: function(invitee) { requestGame(globalStore, invitee); },

  render: function() {
    var state = globalStore.getState();
    var finishedGames = [];
    var activeGames = [];
    var unstartedGames = [];
    var gameIds = state.session.gameIds;
    if (gameIds && gameIds.length) {
      for (var i = 0; i < gameIds.length; ++i) {
        var g = state.games[gameIds[i]];
        if (g.ended)        finishedGames.push(g);
        else if (g.started) activeGames.push(g);
        else                unstartedGames.push(g);
      }
    }

    var activeGameCountLabel = null;
    var activeGameListing;
    if (activeGames.length) {
      activeGameCountLabel = (<span className="o-badge">{activeGames.length}</span>);
      activeGameListing = (<GameListing games={activeGames} />);
    } else {
      activeGameListing = (<p>No games found. You should start a new one!</p>);
    }

    var finishedGameListing = null;
    if (finishedGames.length) {
      finishedGameListing = (<section className="finished-games">
          <h3>Finished <span className="o-badge">{finishedGames.length}</span></h3>
          <GameListing games={finishedGames} />
        </section>);
    }

    /// TODO: FIX THIS WITHOUT NOTIFICATIONS
    var incomingRequestsSection = null;
    var requests;
    if (unstartedGames && unstartedGames.length) {
      requests = Array(unstartedGames.length);
      for (i = 0; i < unstartedGames.length; ++i) {
        var game = unstartedGames[i];
        var hasJoined = false;
        var opponentId;
        for (var j = 0; j < game.moves.length && !hasJoined && opponentId == undefined; ++j) {
          var m = game.moves[i];
          var isOwnMove = m.playerId == state.session.playerId;
          hasJoined = m.type == MOVES.JOIN && isOwnMove;
          if (!isOwnMove) opponentId = m.playerId;
        }

        var opponent = state.users[opponentId];

        if (hasJoined)
          requests[i] = (<tr className="o-table-row">
              <td className="o-table-cell">Waiting on <strong>{opponent.username}</strong> to join</td>
            </tr>);
        else
          requests[i] = (<tr className="o-table-row">
              <td className="o-table-cell"><strong>{opponent.username}</strong></td>
              <td className="o-table-cell notification-actions">
                <button className="o-btn o-btn--inline" onClick={() => acceptGameRequest(globalStore, game.id)}>Accept</button>
                <button className="o-btn o-btn--inline" onClick={() => rejectGameRequest(globalStore, game.id)}>Reject</button>
              </td>
            </tr>);
      }
      incomingRequestsSection = (<section className="incoming-game-requests">
          <h3>Game lobbies <span className="o-badge">{requests.length}</span></h3>
          <table className="o-table lobby-list">
            <thead>
              <tr>
                <th className="o-table-heading">Message</th>
                <th className="o-table-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests}
            </tbody>
          </table>
        </section>);
    }

    return (
      <div>
        <div className="l-g2">
          <div>
            <section className="active-games">
              <h3>Active games {activeGameCountLabel}</h3>
              {activeGameListing}
            </section>
            {finishedGameListing}
          </div>
          <div>
            {incomingRequestsSection}
            <section className="new-game">
              <h3>Start a new game</h3>
              <GameRequestForm onSubmit={this.requestGame} />
            </section>
          </div>
        </div>
      </div>);
  }
});


///
/// Admin views
///

var AlphaCodeManagerView = React.createClass({
  _nextPage: function() { this._loadPage(this.state.offset - this.state.limit); },
  _prevPage: function() { this._loadPage(this.state.offset + this.state.limit); },
  _refresh: function() { this._loadPage(this.state.offset, true); },
  _loadPage: function(newOffset, reload){
    if (this.state.loading) return;

    newOffset = Math.max(newOffset, 0);
    if (this.state.offset == newOffset && !reload) return;

    this.setState({ loading: true });

    var payload = {
      offset:  newOffset,
      limit:   this.state.limit,
      orderBy: this.state.orderBy,
      order:   this.state.order,
    };
    var self = this;
    GET(urls.alphaCodes, payload, function(status, data) {
      self.setState({ loading: false });
      if (statusOK(status)) {
        try {
          data = JSON.parse(data);
        } catch(e) {
          console.error("Problem parsing fetched alpha codes, ", e)
          return;
        }
        self.setState({
          offset: newOffset,
          rows: data,
        });
      }

      /// TODO: warn the user something went wrong.
    }, authHeader(this.props.store.getState()));
  },


  _newCode: function() {
    if (this.state.creatingCode) return;

    var self = this;
    var payload = { count: 1 };
    POST(urls.alphaCodes, payload, function(status, data) {
      if (statusOK(status)) {
        self._refresh();
      } else {
        /// TODO: warn the user something went wrong.
      }
    }, authHeader(this.props.store.getState()));
  },

  getInitialState: function() {
    return {
      creatingCode: false,
      loading: false,
      offset:  0,
      limit:   25,
      orderBy: 'generation_time',
      order:   'ASC',
      /// TODO: add filters for just seeing free or used or pending codes

      rows: []
    };
  },
  componentWillMount: function() { this._loadPage(0, true); },
  render: function() {
    var rowCount = this.state.rows.length;
    var renderedRows = Array(rowCount);
    for (var i = 0; i < rowCount; ++i) {
      var r = this.state.rows[i];
      var u = r.user || {
        created: "---",
        username: "---",
        email: "---",
      };
      var className = "o-table-cell";
      if (!r.user) { className += " empty"; }
      renderedRows[i] = (<tr className="o-table-row">
          <td>{r.generated}</td>
          <td>{r.alphaCode}</td>
          <td className={className}>{u.created}</td>
          <td className={className}>{u.username}</td>
          <td className={className}>{u.email}</td>
          <td className={className}>{(u.roles & roles.user) > 0 ? "X" : ""}</td>
        </tr>);
    }
    return (<div>
      <a className="o-btn o-btn--inline" onClick={this._prevPage}>&lt;</a>
      <a className="o-btn o-btn--inline" onClick={this._refresh}>Refresh</a>
      <a className="o-btn o-btn--inline" onClick={this._nextPage}>&gt;</a> 
      <a className="o-btn o-btn--inline" onClick={this._newCode}>+</a> 
      <table className="o-table alpha-codes">
        <thead>
          <tr>
          <td className="o-table-heading">Generated</td>
          <td className="o-table-heading">Code</td>
          <td className="o-table-heading">Signed up on</td>
          <td className="o-table-heading">Username</td>
          <td className="o-table-heading">Email</td>
          <td className="o-table-heading">Verified</td>
          </tr>
        </thead>
        <tbody>
          {renderedRows}
        </tbody>
      </table>
      </div>);
  }
});


var UserManagerView = React.createClass({
  _nextPage: function() { this._loadPage(this.state.offset - this.state.limit); },
  _prevPage: function() { this._loadPage(this.state.offset + this.state.limit); },
  _refresh: function() { this._loadPage(this.state.offset, true); },
  _loadPage: function(newOffset, reload){
    if (this.state.loading) return;

    newOffset = Math.max(newOffset, 0);
    if (this.state.offset == newOffset && !reload) return;

    this.setState({ loading: true });

    var payload = {
      offset:  newOffset,
      limit:   this.state.limit,
      orderBy: this.state.orderBy,
      order:   this.state.order,
    };
    var self = this;
    GET(urls.users, payload, function(status, data) {
      self.setState({ loading: false });
      if (statusOK(status)) {
        try {
          data = JSON.parse(data);
        } catch(e) {
          console.error("Problem parsing fetched alpha codes, ", e)
          return;
        }
        self.setState({
          offset: newOffset,
          rows: data,
        });
      }

      /// TODO: warn the user something went wrong.
    }, authHeader(this.props.store.getState()));
  },


  _newCode: function() {
    if (this.state.creatingCode) return;

    var self = this;
    var payload = { count: 1 };
    POST(urls.alphaCodes, payload, function(status, data) {
      if (statusOK(status)) {
        self._refresh();
      } else {
        /// TODO: warn the user something went wrong.
      }
    }, authHeader(this.props.store.getState()));
  },

  getInitialState: function() {
    return {
      creatingCode: false,
      loading: false,
      offset:  0,
      limit:   25,
      orderBy: 'generation_time',
      order:   'ASC',
      /// TODO: add filters for just seeing free or used or pending codes

      editId: null,
      editField: null,
      editValues: {},

      rows: []
    };
  },
  changeField: function(e) {
    var fieldId = e.target.name.split('.')
    var editValues = this.state.editValues[fieldId[0]];
    if (!editValues) {
      editValues = this.state.editValues[fieldId[0]] = {};
    }

    function findRolesById(id) {
      for (var i = 0; i < this.state.rows.length; ++i) {
        if (this.state.rows[i].id == id) return this.state.rows[i].roles;
      }
      return 0;
    }

    var r;
    switch(fieldId[1]) {
      case 'verified': 
        r = editValues.roles || findRolesById(fieldId[1]);
        editValues['roles'] = r ^ roles.user;
        break;
      case 'admin':
        r = editValues.roles || findRolesById(fieldId[1]);
        editValues['roles'] = r ^ roles.admin;
        break;
      default: 
        editValues[fieldId[1]] = e.target.value;
    }

    console.log('changing ' + e.target.name);
    var _editValues = this.state.editValues;
    _editValues[fieldId[0]] = editValues;
    this.setState({ editValues: _editValues});
  },
  componentWillMount: function() { this._loadPage(0, true); },
  render: function() {
    var rowCount = this.state.rows.length;
    var renderedRows = Array(rowCount);
    for (var i = 0; i < rowCount; ++i) {
      var u = this.state.rows[i];
      var className = "";
      var dU = this.state.editValues[u.id] || {};
      dU = assign({}, u, dU);

      renderedRows[i] = (<tr key={u.id} className="o-table-row">
          <td className="o-table-cell">{u.created}</td>
          <td className="o-table-cell"><input name={u.id + ".username"} className={"o-input " + (dU.username != u.username ? '--changed' : '')} onChange={this.changeField} value={dU.username} /></td>
          <td className="o-table-cell"><input name={u.id + ".email"}    className={"o-input " + (dU.email != u.email ? '--changed' : '')} onChange={this.changeField} value={dU.email} type="email" /></td>
          <td className="o-table-cell"><input name={u.id + ".verified"} className={"o-input " + (dU.roles & roles.user != u.roles & roles.user ? '--changed' : '')} onChange={this.changeField} type="checkbox" checked={dU.roles & roles.user} /></td>
          <td className="o-table-cell"><input name={u.id + ".admin"}    className={"o-input " + (dU.roles & roles.admin != u.roles & roles.admin ? '--changed' : '')} onChange={this.changeField} type="checkbox" checked={dU.roles & roles.admin} /></td>
          <td className="o-table-cell"><input name={u.id + ".password"} className={"o-input " + (dU.password ? '--changed' : '')} onChange={this.changeField} value={dU.password} type="password" /></td>
        </tr>);
    }
    return (<form onSubmit={noop}>
      <a className="o-btn o-btn--inline" onClick={this._prevPage}>&lt;</a>
      <a className="o-btn o-btn--inline" onClick={this._refresh}>Refresh</a>
      <a className="o-btn o-btn--inline" onClick={this._nextPage}>&gt;</a> 
      <a className="o-btn o-btn--inline" onClick={this._newCode}>+</a> 
      <table className="o-table alpha-codes">
        <thead>
          <tr>
          <td className="o-table-heading">Created</td>
          <td className="o-table-heading">Username</td>
          <td className="o-table-heading">Email</td>
          <td className="o-table-heading">Verified</td>
          <td className="o-table-heading">Admin</td>
          <td className="o-table-heading">Password</td>
          </tr>
        </thead>
        <tbody>
          {renderedRows}
        </tbody>
      </table>
      <input type="submit" className="o-btn" value="commit changes" />
      </form>);
  }
});


var TopBar = React.createClass({
  logout: function() {
    logOut(this.props.store);
  },
  render: function() {
    var state = this.props.store.getState();
    var adminViews = null;
    if ((state.session.roles & roles.admin) > 0) {
      adminViews = [
        (<RouteLink className="o-menu-item" path="admin/alpha-codes">Alpha codes</RouteLink>),
        (<RouteLink className="o-menu-item" path="admin/user-list">Users</RouteLink>)
      ];
    }

    var commandCenterBacklink = this.props.pageName != "Command center" ? [<br />, <RouteLink className="o-menu-item" path="/">Back to command center</RouteLink>] : null;
    return (<div className="c-topbar">
      <div className="primary">
        <div>
          <span className="o-page-name">{this.props.pageName}</span>
          { commandCenterBacklink }
        </div>
        <h1 className="heading">
          <canvas ref={logoSystem.initialize} className="logo-surface" width="100" height="100"></canvas>
          <span className="heading-text">Conquered Space</span>
        </h1>
        <p className="hi">
          Hi {state.session.username || (<span className="intruder">UNKNOWN INTRUDER</span>)}<br/>
          <a className="o-menu-item" onClick={this.logout}>Log Out</a>
        </p>
      </div>
      
      <div className="secondary">
        <PollIndicator store={this.props.store} />
        
        <nav className="top-nav">
          { adminViews }
          <a className="o-menu-item">Notifications</a>
          <a className="o-menu-item">Rules</a>
        </nav>
      </div>
    </div>);
  }
})


function authorize(state) {
  var session = state.session;
  if (isSessionValid(session)) return;
  else                         return 'authorize';
}
function adminOnly(state, previous) {
  var session = state.session;
  if (isSessionValid(session)) {
    if ((session.roles & roles.admin) > 0) return;
    else return '';
  } else {
    return 'authorize';
  }
}
var onRouteEnter = {
  '': noop,
  '/': noop,
  'games/*': authorize,
  'admin/alpha-codes': adminOnly,
  'admin/user-list': adminOnly,
};
function changeRoute(store, rootNode, route) {
  var matchedRoute = rootNode.value;
  var matchedParams = [];
  var foundMatch = false;
  if (route && route.length) {
    var i;
    var segments = route.split('/');
    var activeNodes = [ { node: rootNode, params: [] } ];
    for (i = 0; i < segments.length && activeNodes.length; ++i) {
      var s = segments[i];
      var nodeCount = activeNodes.length;
      var newNodes = [];
      for (var ii = 0; ii < nodeCount; ++ii) {
        var n = activeNodes[ii];
        if (s in n.node.children) {
          newNodes.push({
            node: n.node.children[s],
            params: n.params
          });
        }
        if ('*' in n.node.children) {
          newNodes.push({
            node: n.node.children['*'],
            params: n.params.concat(s)
          });
        }
      }
      activeNodes = newNodes;
    }

    var leafNode = null;
    for (i = 0; i < activeNodes.length && !leafNode; ++i) {
      if (activeNodes[i].node.value) leafNode = activeNodes[i];
    }

    if (leafNode) {
      console.log("matched routes and found: ", leafNode);
      matchedRoute = leafNode.node.value;
      matchedParams = leafNode.params;
      foundMatch = true;
    } else {
      console.warn("Could not find matching route for ", route, activeNodes);
    }
  }

  if (!foundMatch) matchedRoute = '';
  var redirect = onRouteEnter[matchedRoute](store.getState());
  if (typeof redirect == "string") matchedRoute = redirect;


  store.dispatch({
    type: ACTIONS.ROUTE,
    name: matchedRoute,
    params: matchedParams,
    path: route
  });
}

var globalRouteTrie;
function initRouteSystem(store, routes, specialRoutes) {
  //var router = buildRoutes(routes);

  var routes = [ '', 'games/*', 'admin/alpha-codes', 'admin/user-list' ];

  globalRouteTrie = { children: { } };
  for (var k in routes) {
    var segments = routes[k].split('/');
    var currentNode = globalRouteTrie;
    for (var i = 0; i < segments.length; ++i) {
      var s = segments[i];
      if (s == '') { continue; }
      if (!(s in currentNode.children)) { currentNode.children[s] = { children: { } }; }
      currentNode = currentNode.children[s];
    }
    currentNode.value = routes[k];
  }

  function navigateToUrl() {
    var newPath = location.href.substr(document.baseURI.length);
    changeRoute(store, globalRouteTrie, newPath);
  }

  var currentPath = store.getState().route.path;
  navigateToUrl();
  window.onpopstate = navigateToUrl;

  store.subscribe(function(state, dispatch, action) {
    if(action.type === ACTIONS.ROUTE && state.route.path != currentPath) {
      history.pushState({}, "", state.route.path);
      currentPath = state.route.path;
    }
  });
}

window.onpopstate = function() {
  debugger;
}

function renderDefault(params) {
  // return renderGameView([20]);
  return (<div className="content content--wide">
      <TopBar pageName="Command center" store={globalStore} />
      <DashboardView />
    </div>);
}
function renderGameView(params) {
  return (<div className="content content--wide">
      <TopBar pageName="Game" store={globalStore} />
      <GameView id={parseInt(params[0])} store={gameStore} />
    </div>);
}
var Router = React.createClass({
  routeTrie: null,
  routes: {
    "games/*": renderGameView,
    "admin/user-list": function() {
      return (<div className="content content--wide">
          <TopBar pageName="Alpha codes" store={globalStore} />
          <UserManagerView store={globalStore} />
        </div>);
    },
    "admin/alpha-codes": function() {
      return (<div className="content content--wide">
          <TopBar pageName="Alpha codes" store={globalStore} />
          <AlphaCodeManagerView store={globalStore} />
        </div>);
    },
    "/": renderDefault,
    "": renderDefault,
  },
  render: function() {
    if (typeof this.props.route == 'string') {
      assert(this.props.route in this.routes);
      return this.routes[this.props.route](this.props.params);
    } else {
      return null;
    }
  }
});


var RouteLink = React.createClass({
  handleClick: function(e) {
    /// TODO: only do this with primary mouse button..
    e.preventDefault();
    changeRoute(globalStore, globalRouteTrie, this.props.path)
    return false;
  },
  render: function() {
    var className = this.props.className;
    if (!className) className = "link";
    return <a className={className} href={this.props.path} onClick={this.handleClick}>{this.props.children}</a>
  }
});

///
/// Presentational components
///
var SaveFormMixin = {
  saveInputChange: function(event) {
    var inputData = {};
    inputData[event.target.name] = event.target.value;
    this.setState(inputData);
  }
};
var ErrorList = React.createClass({
  render: function() {
    if (this.props.errors) {
      var className = "errors errors_" + this.props.field;
      return (<ul className={className}>
          {this.props.errors.map(e => <li className="error">{e}</li>)}
        </ul>)
    }

    return null;
  }
});


var LabelInputPair = React.createClass({
  render: function() {
    var idPrefix = this.props.id ? this.props.id + '_' : '';
    var id = idPrefix + 'field-' + name;
    var name = this.props.name;

    /// Note: This works when "false" is passed
    var inputProps = withoutFields(this.props, "errors", "label");
    inputProps.id = id;
    inputProps.className = (inputProps.className || "") + " o-input";
    var required = "required" in this.props && this.props.required;

    return (<label className="label-input-pair" htmlFor={id}>
        <span className="o-label">{this.props.label}</span>
        <input {...inputProps}/>
        {<ErrorList field={name} errors={this.props.errors} />}
      </label>);
  }
});



var UserCreationForm = React.createClass({
  mixins: [SaveFormMixin],
  getInitialState: function() {return { errors: {} }; },
  handleSubmit: function(event) {
    var self = this;
    event.preventDefault();
    POST(urls.users, this.state, function(status, data) {
      if (statusOK(status))   { _logIn(globalStore, data); }
      else if (status == 400) { self.setState({ errors: JSON.parse(data) }); }
      else                    { self.setState({ errors: { form: ["The server encountered a problem."] } }); }
    });
    return false;
  },
  render: function() {
    var errs = this.state.errors;
    if (! 'form'     in errs) errs['form']     = null;
    if (! 'email'    in errs) errs['email']    = null;
    if (! 'username' in errs) errs['username'] = null;
    if (! 'password' in errs) errs['password'] = null;

    return <form className="newUserForm" onSubmit={this.handleSubmit}>
      {<ErrorList field="form" errors={errs['form']} />}
      
      <LabelInputPair name="username" label="Username" idPrefix={this.props.id}
        placeholder="capitan_99" errors={errs['username']}
        onChange={this.saveInputChange} required="required" />
      
      <LabelInputPair name="password" label="Password" idPrefix={this.props.id}
        placeholder="••••••••" type="password" errors={errs['password']}
        onChange={this.saveInputChange}  required="required" />

      <LabelInputPair name="email" label="Email" idPrefix={this.props.id}
        placeholder="capitan_99@space-federation.com" type="email" errors={errs['email']}
        onChange={this.saveInputChange} errequired="required" />
      
      <LabelInputPair name="alpha_code" label="Access code" idPrefix={this.props.id}
        placeholder=".... ...." errors={errs['alpha-code']} 
        maxLength="8" minLength="8"
        onChange={this.saveInputChange} equired="required" />
      
      <input type="submit" className="o-btn" value="Sign Up" />
    </form>
  }
});

var LoginForm = React.createClass({
  getInitialState: function() { return { }; },
  onChangePassword: function(event) { this.setState({ password: event.target.value }); },
  onChangeUsername: function(event) { this.setState({ username: event.target.value }); },
  onSubmit: function(event) {
    event.preventDefault();
    logIn(globalStore, this.state.username, this.state.password, this.state.stayLoggedIn);
    return false;
  },
  render: function () {
    var idPrefix = '';
    if (this.props.id) {
      idPrefix = this.props.id + '-';
    }
    var error = null;
    var formClass = "loginForm";
    if (this.props.error) {
      var errorMessage = this.props.error.message;
      if (this.props.error.code == 0) {
        errorMessage = "Ruh roh. Could not reach server";
      }
      error = <p className="o-error error--login">{errorMessage}</p>
      formClass += " form--is-error";
    }
    return (
    <form className="log-in" onSubmit={this.onSubmit}>
      {error}
      <LabelInputPair name="username" label="Username" value={this.state.username} placeholder="keen_commando33"
        onChange={this.onChangeUsername} required="required" />
      <LabelInputPair name="password" value={this.state.password} placeholder="••••••••"
          type="password" onChange={this.onChangePassword} required="required" />
      <input type="submit" value="Log In" className="o-btn" />
    </form>);
  }
});

var RequestPasswordResetForm = React.createClass({
  getInitialState: function() {
    return {
      emailOrUsername: this.props.username || this.props.email,
      runState: "ready"
    };
  },
  onChangeEmailOrUsername: function(event) { this.setState({ emailOrUsername: event.target.value }); },
  onSubmit: function(event) {
    var self = this;
    event.preventDefault();

    var payload = { emailOrUsername: this.state.emailOrUsername };
    POST(BASE_URL + "passwordResets", payload, function(status, data) {
        if (statusOK(status)) self.setState({ runState: "succeeded" });
        else                  self.setState({ runState: "ready", error: data });
      });
    return false;
  },
  render: function() {
    switch (this.state.runState) {
      case "ready": {
        var idPrefix = '';
        if (this.props.id) {
          idPrefix = this.props.id + '-';
        }
        var error = null;
        var formClass = "loginForm";
        if (this.props.error) {
          var errorMessage = this.props.error.message;
          if (this.props.error.code == 0) {
            errorMessage = "Ruh roh. Could not reach server";
          }
          error = <p className="o-error error--login">{errorMessage}</p>
          formClass += " form--is-error";
        }
        return (
        <form className="log-in" onSubmit={this.onSubmit}>
          {error}
          <LabelInputPair label="Email or username" name="username-or-email-field" value={this.state.emailOrUsername} 
            placeholder="keen_commando33" onChange={this.onChangeEmailOrUsername} required="required"/>
          <input type="submit" value="Reset password" className="o-btn" />
        </form>);
      } break;
      case "loading": {
        return <p>"..."</p>;
      } break;
      case "succeeded": {
        return <p>A verification has been sent to you</p>
      }
    }
    
  }
});

var AuthorizationView = React.createClass({
  getInitialState: function() { return { show: "login" }; },
  render: function() {
    var toggleFormLabel, submitLabel, view;
    /// TODO: this should be in routing.
    switch (this.state.show) {
      case "login": {
        view = [
          (<LoginForm error={this.props.store.getState().session.error}/>),
          (<a className="toggle-auth-form" onClick={() => this.setState({show: "new-user"})}>
            create an account instead</a>),
          <br />,
          (<a className="toggle-auth-form" onClick={() => this.setState({show: "reset-password"})}>
            forgot your password?</a>)
        ];
      } break;
      case "new-user": {
        view = [
          (<UserCreationForm />),
          (<a className="toggle-auth-form" onClick={() => this.setState({show: "login"})}>
            or log in</a>)
        ];
      } break;
      case "reset-password": {
        view = [
          (<RequestPasswordResetForm />),
          (<a className="toggle-auth-form" onClick={() => this.setState({show: "login"})}>
            or log in</a>)
        ];
      } break;
      default: invalidCodePath();
    }
    return <section className="v-authorization content">
        <h1 className="heading">
          <canvas ref={logoSystem.initialize} className="logo-surface" width="100" height="100"></canvas>
          <span className="heading-text">Conquered Space</span>
        </h1>
        { view }
      </section>
  }
});

var GameRequestForm = React.createClass({
  mixins: [SaveFormMixin],
  getInitialState: function() {
    return {
      opponentName: "",
      suggestions: [],
      suggestionFocus: 0,
      displaySuggestions: false,
    };
  },
  hideSuggestions: function(e) {
    if (this.state.displaySuggestions) { this.setState({ displaySuggestions: false }); }
  },
  componentWillMount: function() {
    window.addEventListener("click", this.hideSuggestions);
  },
  componentWillUnmount: function() {
    window.removeEventListener("click", this.hideSuggestions);
  },
  loadSuggestions: (function() {
    var timeoutHandle = null;
    var loadSuggestions = function() {
      console.info("load", this.state.opponentName);
      var self = this;
      GET(BASE_URL + "users", { "username-like": this.state.opponentName }, function(status, payload) {
        console.info('loaded', status, payload);
        if (statusOK(status)) {
          self.setState({ suggestions: JSON.parse(payload) });
        }
      });
    };
    return function() {
      if (timeoutHandle) { window.clearTimeout(timeoutHandle); }
      console.info("preparing to load", this);
      timeoutHandle = window.setTimeout(loadSuggestions.bind(this), 100);
    }
  })(),
  handleFocus: function() {
    this.loadSuggestions();
    this.setState({ displaySuggestions: true });
  },
  handleSubmit: function(event) {
    event.preventDefault();
    this.props.onSubmit(this.state.opponentName);
    return false;
  },
  handleSelectSuggestion: function(e) {
    e.stopPropagation();
    this.setState({opponentName: e.target.innerText, displaySuggestions: false });
  },
  handleChange: function(e) {
    this.saveInputChange(e);
    this.loadSuggestions();
  },
  render: function() {
    var error = this.props.error ? <p className="field-error">{this.props.error.message}</p> : null;

    var suggestions = null;
    if (this.state.displaySuggestions) {
      if (this.state.suggestions.length > 0) {
        var suggestionItems = Array(this.state.suggestions.length);
        for(var i = 0; i < suggestionItems.length; ++i) {
          var sug = this.state.suggestions[i];
          suggestionItems[i] = <li className="suggestion">{sug.username}</li>;
        }
        suggestions = (<ul className="usernameSuggestions" onClick={this.handleSelectSuggestion}>
            {suggestionItems}
          </ul>);
      } else if (this.state.opponentName) {
        suggestions = <span className="usernameSuggestions">No user found with that name</span>;
      } else {
        suggestions = <span className="usernameSuggestions">Start typing for user suggestions</span>;
      }
    }
    return <form className="gameRequestForm" onSubmit={this.handleSubmit}>
        <div className="input-button-group">
          <LabelInputPair name="opponentName" label="Opponent" value={this.state.opponentName} placeholder="........"
            onFocus={this.handleFocus} onChange={this.handleChange} onClick={eatEvent} required="required" />
          <input className="o-btn" type="submit" value="challenge" />
        </div>
        {suggestions}
        {error}
      </form>
  }
});

function textFromMove(move) {
  var moveText = '---';
  if (!move) return moveText;

  var player = globalStore.getState().users[move.playerId];
  var username;
  if (player) username = player.username;
  else invalidCodePath();

  switch (move.type) {
    case MOVES.RESIGN: {
      moveText = game.moves.length == 2 ? "$1 did not accept the challenge" : "$1 resigned";
      moveText = format(moveText, username);
    } break;
    case MOVES.JOIN: {
      moveText = game.moves.length == 1 ? "$1 created the game" : "$1 accepted the challenge";
      moveText = format(moveText, username);
    } break;
    case MOVES.MOVE: {
      moveText = "$1 moved a piece from ($2) to ($3)";
      moveText = format(moveText, username, move.from.join(', '), move.to.join(', '));
    } break;
    case MOVES.PLAY_MOTHERSHIP:
    case MOVES.PLAY_CRAWLER:
    case MOVES.PLAY_SCOUT:
    case MOVES.PLAY_HOPPER:
    case MOVES.PLAY_SHIFTER: {
      var shipType = shipFromMove(move.type);
      var label = shipLabels[shipType];
      moveText = format("$1 placed a $2 at ($3)", username, label, move.to.join(', '));
    } break;
    case MOVES.LOSE: {
      moveText = format("$1 is out of the game.", username)
    } break;
    case MOVES.LOSE: {
      moveText = format("Game over! $1 Wins!", username);
    } break;
    default: {
      moveText = "UNKNOWN MOVE TYPE";
    }
  }
}

var GameListing = React.createClass({
  goToGame: function(e) { changeRoute(globalStore, globalRouteTrie, 'games/' + e.currentTarget.getAttribute('data-id')); },
  render: function() {
    var games = this.props.games;
    if (games && games.length) {
      var gameRows = [];
      for (var i = 0; i < games.length; ++i) {
        var game = games[i];
        var state = globalStore.getState();
        var opponentIndex = state.session.userId == game.playersInOrder[0] ? 1 : 0;
        var opponentName = state.users[game.playersInOrder[opponentIndex]].username;

        var moveText = textFromMove(peek(game.moves));
        gameRows.push(<tr data-id={game.id} key={game.id} onClick={this.goToGame} className="o-table-row game-row">
            <td className="o-table-cell opponent-name">{opponentName}</td>
            <td className="o-table-cell lastMove-move">{moveText}</td>
          </tr>);
      }
      return <table className="o-table game-listing">
        <thead>
          <tr>
            <td className="o-table-heading">Playing with</td>
            <td className="o-table-heading">Last move</td>
          </tr>
        </thead>
        <tbody>
          {gameRows}
        </tbody>
        </table>
    } else {
      return null;
    }
  }
});

var PollIndicator = React.createClass({
  render: function() {
    var status = this.props.store.getState().pollStatus;
    var classes = ["pollIndicator"];
    if (!status.running)     { classes.push("pollIndicator" + "--disabled"); }
    else if (status.polling) { classes.push("pollIndicator" + "--busy"); }

    return (<span className={classes.join(" ")} >{status.errors}</span>);
  }
});

var Page = React.createClass({
  renderHomepage: function() {
    var state = this.props.store.getState();
    return (<div>
        <Router route={state.route.name} params={state.route.params} />
      </div>);
  },

  render: function() {
    return isSessionValid(this.props.store.getState().session) ? this.renderHomepage() : <AuthorizationView store={globalStore} />;
  }
});

var pageInstance;
function renderPage() {
  var body = document.getElementById("pageBody");
  pageInstance = React.render(<Page store={globalStore} />, body);
}

var globalStore = createStore(rootReduxer);
function onPageLoad() {

  var starSurface = document.getElementById('particle-surface');
  starSystem.initialize(starSurface);

  startLoop(function(input) {
    starSystem.update(input);
    logoSystem.update(input);
  });
  initPollSystem(globalStore);
  initRouteSystem(globalStore);
  restoreSession(globalStore);
  globalStore.subscribe(renderPage);
  renderPage();
}