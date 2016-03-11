/*
///TODO:

- Routing
- Implement all notifications
    - Game started
    - Opponent accepted game
    - Opponent moved
    - Opponent resigned
    - ...
*/


function assert(a, s) { if (!a) { alert("assert fired! " + s); debugger; } }
function invalidCodePath() { alert("invalid code path reached"); debugger; }
function peek(arr) { return arr[arr.length - 1]; }

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
      subscribers.forEach(function(subscriber) { subscriber(state); });
    },
    subscribe: function(fn) {
      subscribers.push(fn);
      return unsubscribe.bind(fn);
    }
  };

  store.dispatch({});
  return store;
}


function getNow() { return Date.now()/1000; }

// Take a string "hello $1, how is $2", and replace #0 and $1 with supplied arguments
function format(f) {
  for(var i = 1; i < arguments.length; ++i)
    f = f.replace(new RegExp('\\$' + i, 'g'), arguments[i]);
  return f;
}


function encodeMap(data) {
  var encodedData = "";
  for (var dataKey in data) {
    var encodedKey = encodeURIComponent(dataKey);
    var d = data[dataKey];
    /// TODO: more robust array detection?
    if (d && d.length && typeof d != 'string') {
      for (var i = 0; i < d.length; ++i) {
        encodedData += encodedKey + "=" + encodeURIComponent(d[i]) + "&";
      }
    } else {
      encodedData += encodedKey + "=" + encodeURIComponent(d) + "&";
    }
  }
  return encodedData;
}

function openXhr(method, url, cb, headers) {
  var x = new XMLHttpRequest();
  x.open(method, url);
  for (var header in headers) x.setRequestHeader(header, headers[header]);
  x.onreadystatechange = function() { if (x.readyState === x.DONE) cb(x.status, x.response); };
  return x;
}
function GET(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('GET', url + '?' + encodeMap(data), cb, headers).send();
}
function PUT(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('PUT', url + '?' + encodeMap(data), cb, headers).send();
}
function POST(url, data, cb, headers) {
  headers = headers || {};
  headers["Content-type"] = "application/x-www-form-urlencoded";
  openXhr('POST', url, cb, headers).send(encodeMap(data));
}

function statusOK(status) { return status && 200 <= status && status < 300; }

function authHeader(state) {
  return { Authorization: 'BEARER ' + state.session.tokenString};
}
function authPayload(state) {
  return { access_token: state.session.tokenString };
}

var urls = {
  users: BASE_URL + 'users',
  userGames: (uid => [urls.users, uid, 'games'].join('/')),

  games: BASE_URL + 'games',
  gameMoves: (gid => [urls.games, gid, 'moves'].join('/')),
  gamePlayer: ((uid, gid) => [urls.games, gid, 'players', uid].join('/')),
  sessions: BASE_URL + 'sessions',
  notifications: BASE_URL + 'notifications',
  notificationRead: (nid => [urls.notifications, nid, 'read'].join('/')),
};

function mapOver(src, mapping) {
  var target = [];
  for (var key in src) {
    target.push(mapping(src[key], key));
  }
  return target;
}

function assign(/*...objects*/){
  var r = arguments[0];
  for (var i = 1; i < arguments.length; ++i) {
    for (var key in arguments[i]) r[key] = arguments[i][key];
  }
  return r;
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


///
/// State management
///

var ACTIONS = {
  INVALIDATE_GAME_VIEW: 'INVALIDATE_GAME_VIEW',
  ROUTE: "ROUTE",
  RUN_POLLING: "RUN_POLLING",
  POLL: "POLL",
  POLL_SUCCESS: "POLL_SUCCESS",
  POLL_FAILED: "POLL_FAILED",
  LOGGING_IN: "LOGGING_IN",
  LOG_IN_SUCCESFUL: "LOG_IN_SUCCESFUL",
  LOG_IN_FAILED: "LOG_IN_FAILED",
  MAKE_MOVE: "MAKE_MOVE",
  MOVE_FAILED: "MOVE_FAILED",
  MARK_READ: "MARK_READ",
  MARKING_NOTIFICATION_FAILED: "MARKING_NOTIFICATION_FAILED",
};

function rootReduxer(state, action) {
  if(typeof state == "undefined") {
    return {
      routePath: "",
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
        errors: []
      },
      errors: [],
      notifications: {},
      users: {},
      userLookup: { children: {} },
      games: {},
      gameView: gameReduxer(state, action)
    };
  }

  console.log("changing state with action", action);

  switch(action.type) {
  case ACTIONS.ROUTE: 
    var newState = assign({}, state);
    newState.routePath = action.path;
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
    for (k in action.notifications) {
      o = action.notifications[k]
      newState.notifications[o.id] = o;
    }
    for (k in action.games) {
      o = action.games[k]
      for (var kk in o.players) {
        var p = o.players[kk];
        trieInsert(newState.userLookup, p.username, p.id);
        o.players[kk] = p.id;
        newState.users[p.id] = p;
      }
      newState.games[o.id] = o;
    }

    assign(newState.session, {
      user: action.user,
      gameIds: mapOver(action.games, function(g) { return g.id; }),
      unreadNotificationIds: mapOver(action.notifications, function(n) { return n.id; }),
    });
    return newState;

  case ACTIONS.POLL_FAILED:
    var newState = assign({}, state);
    newState.pollStatus.polling = false;
    newState.pollStatus.errors = action.errors;
    return newState;


  case ACTIONS.LOGGING_IN:
    var newState = assign({}, state);
    newState.session.loading = true;
    return newState;
  case ACTIONS.LOG_IN_SUCCESFUL:
    var newState = assign({}, state);
    assign(newState.session, {
      loading: false,
      tokenString: action.session.tokenString,
      userId: action.session.data.uid,
      username: action.session.data.sub,
      expiration: action.session.data.exp,
      errors: []
    });
    return newState;
  case ACTIONS.LOG_IN_FAILED:
    var newState = assign({}, state);
    assign(newState.session, {
      loading: false,
      tokenString: null,
      userId: null,
      username: null,
      expiration: 0,
      errors: action.errors
    });
    return newState;

  case ACTIONS.REJECT_GAME_REQUEST:
  case ACTIONS.ACCEPT_GAME_REQUEST:
    // this is an optimistic action.
    var newState = assign({}, state);
    var moveType = action.type == ACTIONS.ACCEPT_GAME_REQUEST ? 
      MOVES.JOIN : MOVES.RESIGN;
    newState.games[action.gameId].moves.push({ 
      type: moveType, playerId: newState.session.user.id });

    return newState;

  case ACTIONS.MARKING_NOTIFICATION_FAILED:
  case ACTIONS.MOVE_FAILED:
    var newState = assign({}, state);
    newState.errors.push(action.error);
    return state;

  case ACTIONS.MARK_READ:
    // this is an optimistic action.
    var newState = assign({}, state);
    newState.notifications[action.id].read = true;
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


/// NOTE(): checking the user id should not be neccesary, but I don't think it is harmful..
function isSessionValid(session) { return session.userId && getNow() < session.expiration; }

/// Routing
var RouteLink = React.createClass({
  handleClick: function(e) {
    /// TODO: only do this with primary mouse button..
    e.preventDefault();
    globalStore.dispatch({
      type: ACTIONS.ROUTE,
      path: this.props.path
    });
    return false;
  },
  render: function() {
    return <a href={this.props.path} onClick={this.handleClick}>{this.props.children}</a>
  }
});

var Router = React.createClass({
  componentWillMount: function() {
    this.buildRoutes();
  },
  routeTrie: null,
  routes: {
    "games/*": function(params) {
      var state = globalStore.getState();
      var gameView = state.gameView;
      var id = parseInt(params[0]);
      var data = state.games[id];
      if (gameView.id != id || gameView.lastMoveCreated < peek(data.moves).created) {
        var playersById = {};
        for (var i = 0; i < data.players.length; ++i) {
          var pid = data.players[i];
          playersById[pid] = assign({}, state.users[pid]);
        }
        globalStore.dispatch({
          type: GAME_ACTIONS.LOAD,
          id: id,
          moves: data.moves,
          playersById: playersById
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

      return (<GameBoard {...globalStore.getState().gameView} />);
    },
    "testRoute": function(params) {
      return <span> HELLO WORLD </span>
    },
    "test/param/*": function(params) {
      if (params.length != 1) console.error("expected test route to have 1 parameter.", param);

      return <span>HEllo {params[0]}</span>
    },
    "test/*/multi/*/params/*": function(params) {
      return (<ul>
          {params.map((p, i) => <li>{i}: {p}</li> )}
        </ul>);
    }
  },
  buildRoutes: function() {
    this.routeTrie = { children: { } };
    for (var k in this.routes) {
      var segments = k.split('/');
      var currentNode = this.routeTrie;
      for (var i = 0; i < segments.length; ++i) {
        var s = segments[i];
        if (! (s in currentNode.children)) {
          currentNode.children[s] = { children: { } };
        }
        currentNode = currentNode.children[s];
      }
      currentNode.handler = this.routes[k];
    }
  },
  render: function() {
    var i;
    var segments = this.props.url.split('/');
    var activeNodes = [ { node: this.routeTrie, params: [] } ];
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
      if (activeNodes[i].node.handler) leafNode = activeNodes[i];
    }

    if (leafNode) {
      console.log("matched routes and found: ", activeNodes);
      return activeNodes[0].node.handler.call(this, leafNode.params);
    } else {
      console.error("Could not find matching route for ", this.props.url, activeNodes);
      return null;
    }
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

var UserCreationForm = React.createClass({
  mixins: [SaveFormMixin],
  handleSubmit: function(event) {
    event.preventDefault();
    POST(urls.users, this.state, function() {
      console.log("user should be registered")
      console.log(arguments);
    })
    return false;
  },
  render: function() {
    return <form>
      <label>Username <input name="username" onChange={this.saveInputChange} /></label>
      <label>Password <input name="password" onChange={this.saveInputChange} type="password" /></label>
      <label>Email <input name="email" onChange={this.saveInputChange} type="email" /></label>
      <button onClick={this.handleSubmit}>Sign Up</button>
    </form>
  }
});

var LoginForm = React.createClass({
  getInitialState: function() { return { }; },
  onChangePassword: function(event) { 
    if (event.target.value == '') console.log(event.target, event, event.target.value);
    this.setState({ password: event.target.value }); 
  },
  onChangeUsername: function(event) { 
    if (event.target.value == '') console.log(event.target, event, event.target.value);
    this.setState({ username: event.target.value }); 
  },
  onSubmit: function(event) {
    event.preventDefault();
    console.log(this.state);
    this.props.onSubmit(this.state.username, this.state.password);
    return false;
  },
  render: function () {
    //console.log(this);
    return (
    <form>
      <label>Username: <input onChange={this.onChangeUsername} value={this.state.username} placeholder="..."/></label>
      <label>Password: <input onChange={this.onChangePassword} type="password" value={this.state.password}/></label>
      <button onClick={this.onSubmit}>log in</button>
    </form>);
  }
});

var UserSummary = React.createClass({
  render: function() {
    return <p>
        Hello {this.props.username || "<<UNKNOWN INTRUDER>>"}!
      </p>
  }
});

var GameRequestForm = React.createClass({
  mixins: [SaveFormMixin],
  getInitialState: function() {
    return {

    };
  },
  handleSubmit: function(event) {
    event.preventDefault();
    console.log(this.state, this.props);
    this.props.onSubmit(this.state.opponentName); 
    return false;
  },
  handleRandomize: function(event) {
    event.preventDefault();
    this.props.onSubmit();
  },
  render: function() {
    return <form onSubmit={this.handleSubmit}>
        <label>
          Opponent: <input name="opponentName" onChange={this.saveInputChange} value={this.state.opponentName} placeholder="username" />
          <button onClick={this.handleRandomize}>Random</button>
        </label>
        <input type="submit" value="request" />
      </form>
  }
});

var TopBar = React.createClass({
  render: function() {
    return <UserSummary username={this.props.session.username} />
  }
});

var NOTIFICATIONS = {
  GAME_REQUEST_RECEIVED: "GAME_REQUEST_RECEIVED",
  GAME_REQUEST_ACCEPTED: "GAME_REQUEST_ACCEPTED",
  GAME_REQUEST_REJECTED: "GAME_REQUEST_REJECTED",
  OPPONENT_PLAYED_PIECE: "OPPONENT_PLAYED_PIECE",
  OPPONENT_MOVED_PIECE:  "OPPONENT_MOVED_PIECE",
  OPPONENT_RESIGNED:     "OPPONENT_RESIGNED",
}

var notificationMessages = [
  { //v0
    GAME_REQUEST_RECEIVED: "$2 challenges you to a game.",
    GAME_REQUEST_ACCEPTED: "$2 accepted your challenge.",
    GAME_REQUEST_REJECTED: "$2 rejected your challenge.",
    OPPONENT_PLAYED_PIECE: "$2 played a $3 at ($4, $5).",
    OPPONENT_MOVED_PIECE:  "$2 moved a piecte from ($3, $4) to ($5, $6).",
    OPPONENT_RESIGNED:     "$1 resigned.",
  }
];

var Notification = React.createClass({
  __acceptOrRejectRequest: function(accept) {
    var gameId = this.props.parameters[0];
    var optimisticAction = ACTIONS[accept ? "ACCEPT_GAME_REQUEST" : "REJECT_GAME_REQUEST"];
    var failAction = accept ? ACTIONS.ACCEPT_FAILED : ACTIONS.REJECT_FAILED;
    var moveType = accept ? MOVES.JOIN : MOVES.RESIGN;
    var self = this;

    globalStore.dispatch({ type: optimisticAction, gameId: gameId });
    var state = globalStore.getState();

    POST(urls.gameMoves(gameId), {
        type: moveType,
        access_token: state.session.tokenString
      }, function(status, data){
        if (statusOK(status)) {
          self.markNotificationRead();
        } else {
          globalStore.dispatch({
            type: failAction,
            gameId: gameId,
            error: data
          });
        }
      });
  },
  acceptGameRequest: function() {
    this.__acceptOrRejectRequest(true);
  },
  rejectGameRequest: function() {
    this.__acceptOrRejectRequest(false);
  },


  markNotificationRead: function() {
    var id = this.props.id;
    globalStore.dispatch({ type: ACTIONS.MARK_READ, id: id });

    var state = globalStore.getState();

    PUT(urls.notificationRead(id), authPayload(state),
      function(status, data) {
        if (! statusOK(status)) {
          globalStore.dispatch({
            type: ACTIONS.MARKING_NOTIFICATION_FAILED,
            id: id,
            error: data
          });
        }
      });
  },

  render: function() {
    var props = this.props;
    var state = globalStore.getState();
    function idToUsername(state, id) {
      /// TODO: load user if not in cache.
      var name = "UNKNOWN USER";
      var user = state.users[id];
      if (user) name = user.username;
      return name;
    }

    var content;
    var type = props.notificationType.name;
    var classes = format("notification notification--$1 notification--$2", 
      type, props.read ? "read" : "unread");

    var messageFormat = notificationMessages[props.notificationType.version][type];
    var message;
    switch (type) {
      case 'GAME_REQUEST_RECEIVED': {
        content = (<div className={classes}>
            {format(messageFormat, props.parameters[1])}
            <button onClick={this.acceptGameRequest}>Accept</button>
            <button onClick={this.rejectGameRequest}>Reject</button>
          </div>);
      } break;

      case 'GAME_REQUEST_ACCEPTED': 
      case 'OPPONENT_MOVED_PIECE':
      case 'OPPONENT_PLAYED_PIECE':
      case 'OPPONENT_RESIGNED': {
        var gamePath = 'games/' + props.parameters[0];
        props.parameters[1] = idToUsername(state, props.parameters[1]);
        var formatArguments = [messageFormat].concat(props.parameters);
        message = format.apply(null, formatArguments);

        content = (<div className={classes}>
            {message} <RouteLink path={gamePath}>Go to game</RouteLink>
            <button onClick={this.markNotificationRead}>done</button>
          </div>);
      } break;

      case 'GAME_REQUEST_REJECTED': {
        message = format(messageFormat, idToUsername(state, props.parameters[1]))
        content = (<div className={classes}>{message} <button onClick={this.markNotificationRead}>done</button></div>)
      } break;

      default:
        invalidCodePath();
    }

    return content;
  },
});

var GameRow = React.createClass({
  render: function() {
    var game = this.props.game;
    var state = globalStore.getState();
    var playerLabels = this.props.game.players.map((player, i) => <span className="player-label player--{i + 1}">{state.users[player].username}</span>);
    if (state.session.userId && state.session.userId == this.props.game.players[1]) {
      playerLabels[1] = playerLabels[0];
    }

    var lastMove = null;
    if (game.moves.length) {
      var move = peek(game.moves);
      var username = state.users[move.playerId].username;
      var moveText;
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
            moveText = format(moveText, username, 
              move.from.join(', '), move.to.join(', '));
          } break;
          case MOVES.PLAY_MOTHERSHIP:
          case MOVES.PLAY_SCOUT:
          case MOVES.PLAY_SHIFTER: {
            var shipType = shipFromMove(move.type);
            var label = shipLabels[shipType];

            moveText = format("$1 placed a $2 at ($3)", username,
              label, move.to.join(', '));

          } break;
          default: {
            moveText = "UNKNOWN MOVE TYPE";
          }
      }
      lastMove = (<span className="lastMove">
          <span className="lastMove-label">Last move: </span> 
          <span className="lastMove-move">{moveText}</span>
        </span>);
    }

    return <li>
      <RouteLink path={"games/" + game.id}> go to game </RouteLink>
        {state.session.userId ? null : playerLabels[0]} <span className="versus-label">vs.</span> {playerLabels[1]}
        {lastMove}
      </li>
  }
});
var GameListing = React.createClass({
  render: function() {
    return <ul className="game-listing">
        {this.props.games.map((game) => <GameRow key={game.id} game={game} />)}
      </ul>
  }
});

var GameRequestNotification = React.createClass({
  acceptGameRequest: function() { 
    this.props.acceptGameRequest(this.props.parameters[1], this.props.notificationId);
  },
  rejectGameRequest: function() { 
    this.props.rejectGameRequest(this.props.parameters[1], this.props.notificationId);
  },
  render: function() {
    var challanger = this.props.parameters[0];
    return (<span>
      {challanger} challenges you to a game. 
      <button onClick={this.acceptGameRequest}>Accept</button>
      <button onClick={this.rejectGameRequest}>Reject</button>
    </span>);
  }
})

var Spinner = React.createClass({
  render: function() {
    return <span>You spin me right round baby, right round, like a record baby, right round round round </span>
  }
});

var PollIndicator = React.createClass({
  intervalHandle: null,
  pollRequest: null,
  componentWillMount: function() {
    var self = this;
    var store = this.props.store;

    function poll() {
      var state = store.getState();
      if (state.pollStatus.polling) {
        console.error("Trying to poll but poller is busy..");
        return;
      }
      if (! isSessionValid(state.session)) {
        console.error("Trying to poll, but the session is not valid.");
        return;
      }

      store.dispatch({ type: ACTIONS.POLL });
      /// NOTE(): It'd be super cool to get some delta system working, to reduce the bandwidth load.
      GET(urls.users + '/' + state.session.userId,
        { filter: 'dashboard' }, 
        function(status, data) {
          if (statusOK(status)) {
            var dashboardData = JSON.parse(data);
            store.dispatch(assign(dashboardData, { type: ACTIONS.POLL_SUCCESS }));
          } else {
            store.dispatch({
              type: ACTIONS.POLL_FAILED,
              errors: data
            });
          }
        },
        authHeader(state)
      );

    }
    store.dispatch({ type: ACTIONS.RUN_POLLING });
    self.intervalHandle = setInterval(poll, POLL_DT);
    store.subscribe(function() {
      var status = store.getState().pollStatus;
      if (self.intervalHandle && !status.running) {
        clearInterval(self.intervalHandle);
      }
    });

    poll();
  },
  componentWillUnmount: function() {
    this.props.store.dispatch({ type: ACTIONS.POLLING_STOPPED });
  },
  render: function() {
    var status = this.props.store.getState().pollStatus;
    var classes = ["pollIndicator"];
    if (!status.running) {
      classes.push("pollIndicator" + "--disabled");
    } else if (status.polling) {
      classes.push("pollIndicator" + "--busy");
    }
    return (<span className={classes.join(" ")} >{status.errors}</span>);
  }
});

var Page = React.createClass({
  login: function(username, password) {
    var self = this;
    this.props.store.dispatch(function(dispatcher) {
      dispatcher({ type: ACTIONS.LOGGING_IN });

      POST(urls.sessions, { username: username, password: password }, (status, data) => {
        if (statusOK(status)) {
          var tokenParts = /([^.]+).([^.]+).([^.]+)/.exec(data);
          var session = {
            tokenString: data,
            header: JSON.parse(atob(tokenParts[1])),
            data: JSON.parse(atob(tokenParts[2]))
          };
          dispatcher({ 
            type: ACTIONS.LOG_IN_SUCCESFUL,
            session: session
          });

          console.log("logged in", session);
        } else {
          dispatcher({
            type: ACTIONS.LOG_IN_FAILED,
            error: {
              code: status,
              message: data
            }
          });
        }
      });
    });
  },


  requestGame: function(invitee) {
    console.log("requesting game", arguments);
    var session = this.props.store.getState().session;
    if (typeof invitee != "undefined") {
      var dest = urls.userGames(session.userId);
      POST(dest, { invitees: invitee, access_token: session.tokenString }, function() {
        console.log("game request against " + invitee + " posted with results:", arguments )
      });
    }
  },
  renderNotificationList: function(notifications) {
    return (<ol>
        {mapOver(notifications, function(n) {
          if (!n.read) {
            return (<li key={n.id}><Notification {...n} /></li>);
          }
        })}
      </ol>);
  },

  renderHomepage: function() {
    var self = this;
    var state = this.props.store.getState();
    var games = mapOver(state.session.gameIds, function(id) { return state.games[id]; });
    var notifications = mapOver(state.session.unreadNotificationIds, function(id) { return state.notifications[id]; });

    return (<div>
        <PollIndicator store={this.props.store} />
        {this.renderNotificationList(notifications)}

        <div style={{border: "1px solid black"}}>
          <Router url={state.routePath} />
        </div>

        <RouteLink path="games/*">"games/*"</RouteLink>
        <RouteLink path="testRoute">"testRoute"</RouteLink>
        <RouteLink path="test/param/foobar">"test/param/*"</RouteLink>
        <RouteLink path="test/bloop/multi/blip/params/blap">"test/*/multi/*/params/*"</RouteLink>
        <TopBar session={state.session} />
        <GameListing games={games} />
        <h2>Request new game</h2>
        <GameRequestForm onSubmit={this.requestGame} />
      </div>);
  },
  renderUnauthenticated: function() {
    return <div>
        <LoginForm onSubmit={this.login}/>
        <UserCreationForm onSubmit={this.createUser} />
      </div>
  },

  render: function() {
    return isSessionValid(this.props.store.getState().session) ? this.renderHomepage() : this.renderUnauthenticated();
  }
});

function defer(fn) { setTimeout(fn, 0); }

var pageInstance;
function renderPage() {
  var body = document.getElementById("pageBody");
  pageInstance = React.render(<Page store={globalStore} />, body);
}

var globalStore = createStore(rootReduxer);
function onPageLoad() {
  globalStore.subscribe(renderPage);
  renderPage();
}


/// TODO: Do data fetching based on react component life cycle as in http://notjoshmiller.com/ajax-polling-in-react-with-redux/

