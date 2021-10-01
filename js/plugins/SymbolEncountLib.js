//=============================================================================
// SymbolEncountLib.js
//=============================================================================

/*:
 * @plugindesc The library for building symbol encount system.
 * @author Sasuke KANNAZUKI
 *
 * @help Encounter Symbol is an Event that implements
 * auto search/chase/escape algorhithm.
 * 
 * *Note Description:
 * <sym:41> variable ID for this encounter symbol.
 *   An event is encounter symbol if this notation is in the note.
 * <troop:15> troop ID.
 *   at battle command, this configuration is used.
 * <limit:12> search limit (default 8)
 * <symFlag:3>
 * 0x01 : return flag
 *  when it misses the player, return to the original position.
 * 0x02 : escape flag
 *  when it encounts the stronger player, avoid battle and escape.
 * 0x04 : no chase flag
 *  neither chase nor escape from player
 *  (usage ex. the event that is keep moving specified moving route)
 * 0x08 : use different image at each page
 *  at default, used the same image for all state
 *  (page 1's image is used at all event pages).
 * <cType:2> symbol's trait flag (default:2)
 * 0x07 : sight of view(0=0, 1=22.5, 2=45, 3=67.5 4=90 degree)
 * 0x08 : listen to the sound of player
 *  (aware near(limit/2) player even if they are out of the view).
 *
 * *Main Mechanism:
 * Encounter Symbol is a FSM(Finite State Machine) Event,
 * where its each page is a state of the FSM.
 * The current state is the number of specified variable's number.
 * 
 * *The FSM States:
 * 0 : NORMAL: Search player
 *  - *automatically search for player. when it find the player,
 *   transit to state 1(find).
 *  - exception : if "no chase flag" is true,
 *   not transit to state 1 automatically.
 *  - event trigger must be "touch by event": at command list,
 *   immediately transit to state 3(battle).
 * 1 : FIND
 *  - event trigger must be "auto" or "parallel": at command list,
 *   immediately transit state to 2(chase) or 7(escape)
 *  - you may also display surprise baloon icon.
 * 2 : CHASE
 *  - *automatically chase the player. if capture, transit to state 3(battle),
 *   if lost the trace, to state 5(miss).
 *  - event trigger must be "touch by event": at command list,
 *   immediately transit to state 3(battle).
 * 3 : BATTLE
 *  - event trigger must be "auto": process battle.
 *   When player wins, transit to state 8(troop defeated),
 *   player escapes, to state 4(escaped by player),
 *   player defeated, to invoke user specified common event, or game over.
 * 4 : ESCAPED_BY_PLYR
 *  - event trigger must be "parallel": event may be through and low opacity.
 *   stop several minits.
 *  - and then, transit to state 6(back home position),
 *   or 0(normal:abondon to back home)
 * 5 : MISS
 *  - event trigger must be "auto" or "parallel": immediately transit
 *   to state 6(back home) or 0(normal).
 *  - you may also display depressed baloon icon.
 * 6 : GO_HOME
 *  - *automatically go for the home position. when player approach,
 *   transit to state 1(find),
 *   when player touch, to state 3(battle), when back home, to state 0(normal).
 *  - event trigger must be "touch by event": at command list,
 *   immediately transit to state 3(battle).
 * 7 : ESCAPE
 *  - *automatically escape from player.
 *   when player touch, transit to state 3(battle),
 *   when keep away from player, to state state 6(back home) or 0(normal).
 *  - event trigger must be "touch by PLAYER": at command list,
 *   immediately transit to state 3(battle).
 * 8 : DEFEATED
 *  - event trigger must be "parallel":event may be through and
 *   blink several seconds. and then, transit to state 99(erased).
 * 99 : ERASED
 *  - event trigger must be "parallel": do "erase event".
 *
 * *State Options:
 * - at state 0, 2, 6, and 7, set 'self movement' be 0(=none)
 *  to make it default movement. you may change 'self movement' setting
 *  to customize the movement of the state.
 * - at 'no chase flag', necessary stats are only 0, 3, 4, 6, 8 and 99.
 *  when you make the setting, you can omit unuse pages.
 *
 * *Plugin Commands:
 * SymbolEncountLib transit arg1
 *   - arg1 must be the number.
 *   Transit to the state arg1.
 * SymbolEncountLib transit chaseOrEscape arg2
 *   Call at state1.
 *   It does the process that make prefer choice and transit to the state.
 *   - arg2 must be the troop ID. default value is the set value in the note.
 *   -ex. SymbolEncountLib transit chaseOrEscape 10
 * SymbolEncountLib transit goHomeOrChase
 *   Call at state4 and 5.
 *   It does the process that make choice and transit to the state.
 */
/*:ja
 * @plugindesc シンボルエンカウントを実装するためのライブラリです。
 * @author 神無月サスケ
 *
 * @help イベントのエンカウントシンボルは、自動索敵、自動追跡、
 * 自動逃避のアルゴリズムを実装しています。
 * 
 * ◆メモ
 * <sym:41> シンボル用の変数ID
 * このタグがメモに書かれている時、そのイベントは
 * エンカウントシンボルとみなされます。
 * そしてこの変数の値が、シンボルのステート(後述)を表します。
 * <troop:15> 敵キャラID
 *   戦闘の際、イベントコマンドの指定にかかわりなく、
 *   このIDの敵グループとの戦闘になります。
 * <limit:12> 探索の深さです。
 * この値が大きいほど、遠くから追いかけてきて、遠くまで追いかけていきます。
 *  省略可能(デフォルト： 8)
 * <symFlag:3> 様々なフラグです。以下にビット列を示します。(デフォルト値:3)
 * 0x01 : 所定位置に戻るか
 * 0x02 : 自分が弱いと逃げ出すか
 * 0x04 : 追跡、逃亡を行わない（常に一定ルートを動く敵など）
 * 0x08 : ページごとに画像(歩行グラフィック)を設定
 * デフォルトではページ1で指定した画像を全てのページで使います。
 * <cType:2> シンボルの特徴を示すフラグです。(デフォルト値:2)
 * 0x07 : 視野の広さ(0=目の前だけ, 1=22.5度, 2=45度, 3=67.5度, 4=90度)
 * 0x08 : 近く(limitの半分)に来たら視界になくても音でプレイヤーに気づくか
 *
 * ◆基本原理
 * エンカウントシンボルを有限状態機械(FSM)に見立て、
 * 一つのイベントページを一つの状態とみなします。
 * 指定された変数の値が、現在のステートになります。
 *
 * ◆FSMのステート
 * 0 : ノーマル：索敵(NORMAL: Search player)
 *  - ★自動で索敵を行います。プレイヤーを発見したら状態1に遷移します。
 *  - 上記の例外：「追跡、逃亡を行わない」フラグがONの時は、
 *   自動では状態1に遷移しません。
 *  - トリガーは「イベントから接触」、
 *   実行内容は「すぐに状態3(戦闘)に遷移」です。
 * 1 : 発見 (FIND)
 *  - トリガーは「自動実行」または「並列実行」で、実行内容は、
 *   「逃げるか判定し、すぐに状態2(追跡)か7(逃げる)に遷移」です。
 *   ※吹き出しアイコン「！」の表示を想定しています。
 * 2 : 追跡(CHASE)
 *  - ★自動で追跡を行います。プレイヤーに接触したら状態3(戦闘)、
 *   見失ったら状態5に遷移します。
 *  - トリガーは「イベントから接触」、
 *   実行内容は「すぐに状態3(戦闘)に遷移」です。
 * 3 : 戦闘(BATTLE)
 *  - トリガーは「自動実行」で、バトルの処理を行います。
 *  - プレイヤーが勝てば状態8に、逃げれば状態4に遷移します。
 *  - プレイヤーが全滅した場合、特定のコモンイベントに飛ぶか、
 *   さもなくばゲームオーバーです。
 * 4 : 逃げられた(ESCAPED_BY_PLYR)
 *  -トリガーは「並列実行」で、一時的に停止状態：半透明：すり抜け：
 *   2秒間ほど動かない状態にします。
 *  -その後「所定位置に戻るか」フラグに応じて状態6(戻る)か状態0(戻らない)に遷移
 * 5 : 見失う(MISS)
 *  - トリガーは「自動実行」または「並列実行」で、
 *   即座に「所定位置に戻るか」フラグに応じて
 *   状態6(戻る)か状態0(戻らない)に遷移。
 *   ※吹き出しアイコン「くしゃくしゃ」の表示を想定しています（お好みで）
 * 6 : 所定位置に戻る(GO_HOME)
 *  - ★自動的に元の場所に戻り始めます。プレイヤーが近づいたら状態1(発見)に、
 *   接触したら状態3(戦闘)に遷移、
 *   元の場所にたどり着いたら状態0(戻らない)に遷移。
 *  - トリガーは「イベントから接触」、
 *   実行内容は「すぐに状態3(戦闘)に遷移」です。
 * 7 : 逃避(ESCAPE)
 *  - ★自動的にプレイヤーから遠ざかります。プレイヤーの方が接触してきた場合、
 *   状態3(戦闘)に遷移します。プレイヤーから十分遠ざかった場合、
 *   フラグに応じて状態6(戻る)か状態0(ノーマル)に遷移します。
 *  - トリガーは「プレイヤーから接触」、
 *   実行内容は「すぐに状態3(戦闘)に遷移」です。
 * 8 : 退治された(DEFEATED)
 *  - トリガーは「並列処理」で、敵が消えるアニメーション
 *  （すり抜けで数秒点滅するなど）を入れます。
 *   アニメーションが終わったら、状態99(消滅)へ遷移します。
 * 99 : 消滅(ERASED)
 *  - トリガーは「並列処理」で、「イベントの一時消去」を行います。
 *
 * ◆状態に関する注意
 * - 状態0, 2, 6, 7では、「自律移動」の「タイプ」を「固定(=0)」にした場合に
 *  デフォルトの動作をします。
 *  これを別の状態に設定すると、その動きに切り替わります。
 *  動作を自分でカスタムしたい時は利用してください。
 * （例：追跡時を「プレイヤーに近づく」に変更するなど）
 * - 「追跡、逃亡を行わない」フラグの立ったイベントでは、
 *  使用する状態は0, 3, 4, 6, 8, 99だけです。
 *  このようなイベントでは、これ以外の状態は作る必要はありません。
 * 
 * ◆プラグインコマンド
 * SymbolEncountLib transit arg1
 *   arg1は数字です。この場合、arg1で指定された状態に遷移します。
 * SymbolEncountLib transit chaseOrEscape arg2
 *   状態1で呼び出します。「逃げるか判定し、すぐに状態2(追跡)か7(逃げる)に
 *   遷移する」処理を行います。
 *   arg2 は敵グループのIDにしてください。省略した場合メモの値が使われます。
 *   例：SymbolEncountLib transit chaseOrEscape 10
 *   10番の敵グループがプレイヤーと強さを比較して追跡するか逃げるか決める
 * SymbolEncountLib transit goHomeOrChase
 *   状態4,5で呼び出します。「『所定位置に戻るか』フラグに応じて
 *   状態6(戻る)か状態0(戻らない)に遷移する」処理を行います。
 */

(function() {
  // ---------------------------------------
  //  process plugin commands
  // ---------------------------------------
  var _Game_Interpreter_pluginCommand =
   Game_Interpreter.prototype.pluginCommand;
  Game_Interpreter.prototype.pluginCommand = function(command, args) {
    _Game_Interpreter_pluginCommand.call(this, command, args);
    if (command === 'SymbolEncountLib') {
      var theEvent = $gameMap._events[this._eventId];
      var isValid = !!theEvent && theEvent.isSymEnc
      if (isValid && args[0] === 'transit'){
        if (args[1] === 'chaseOrEscape') {
          var id = Number(args[2]) || theEvent.SymEncTroopID;
          if (theEvent.SymEncIsEscape && theEvent.symEncToEscapeOrNot(id)){
            theEvent.symEncTransit(7);  // escape
          } else {
            theEvent.symEncTransit(2);  // chase
          }
        } else if (args[1] === 'goHomeOrChase') {
          theEvent.symEncTransit(theEvent.SymEncIsBackHome ? 6 : 0);
        } else if (!isNaN(Number(args[1]))) {
          theEvent.symEncTransit(Number(args[1]));
        }
      }
    }
  };

  // ---------------------------------------
  //  player finding routine
  // ---------------------------------------
  //
  // Bresenham's algorhithm : direct line drawing routine 
  // note: this algorithm doesn't assume looping map!!!
  //
  Game_Character.prototype.getBresenhamRoute = function(goalX, goalY) {
    // initialize
    var delta = {x: (goalX - this.x), y: (goalY - this.y)};
    var currentNode = {x: this.x, y: this.y};
    var path = [{x: currentNode.x, y: currentNode.y}];
    // find direction
    var step = {};
    step.x = delta.x < 0 ? -1 : 1;
    step.y = delta.y < 0 ? -1 : 1;
    delta.x = Math.abs(delta.x * 2);
    delta.y = Math.abs(delta.y * 2);
    // start bresenham algorithm
    if (delta.y > delta.x){
      var fraction = delta.x * 2 - delta.y;
      while (currentNode.y != goalY) {
        if (fraction >= 0) {
          currentNode.x += step.x;
          fraction -= delta.y;
        }
        currentNode.y += step.y;
        fraction += delta.x;
        path.push({x: currentNode.x, y: currentNode.y});
      }
    } else {
      var fraction = delta.y * 2 - delta.x;
      while (currentNode.x != goalX) {
        if (fraction >= 0) {
          currentNode.y += step.y;
          fraction -= delta.x;
        }
        currentNode.x += step.x;
        fraction += delta.y;
        path.push({x: currentNode.x, y: currentNode.y});
      }
    }
    return path;
  };

  //
  // check the character can see the player (see == passable)
  //
  Game_Map.prototype.checkPassageForAllDirection = function(x, y) {
    var flags = this.tilesetFlags();
    var tiles = this.allTiles(x, y);
    for (var i = 0; i < tiles.length; i++) {
      var flag = flags[tiles[i]];
      if ((flag & 0x10) !== 0){  // [*] No effect on passage
        continue;
      }
      return (flag & 0x0f) === 0;
    }
    return false;
  };

  Game_Character.prototype.canSeeTheCharacter = function(x, y){
    var path = this.getBresenhamRoute(x, y);
    for (i = 0; i < path.length; i++){
      if(!$gameMap.checkPassageForAllDirection(path[i].x, path[i].y)){
        return false;
      }
    }
    return true;
  };

  Game_Character.prototype.canSeePlayer = function(){
    return this.canSeeTheCharacter($gamePlayer.x, $gamePlayer.y);
  };

  //
  // check the character is toward the player
  //
  Game_Character.prototype.directionTo = function(character) {
    var sx = this.deltaXFrom(character.x);
    var sy = this.deltaYFrom(character.y);
    if (Math.abs(sx) > Math.abs(sy)) {
      return sx > 0 ? 4 : 6;
    } else if (sy !== 0) {
      return sy > 0 ? 8 : 2;
    }
  };

  Game_Character.prototype.isTowardPlayer = function() {
    return this.direction() === this.directionTo($gamePlayer);
  };

  //
  // check the player is the range of view
  //
  Game_Character.prototype.isRangeOfView =
   function(character, distance, angleRate) {
    if(!this.isTowardPlayer()){
      return false;
    }
    var sx = this.deltaXFrom(character.x);
    var sy = this.deltaYFrom(character.y);
    switch (this.direction()) {
    case 4:
    case 6:
      return (Math.abs(sx) + Math.abs(sy) <= distance &&
       Math.abs(sy) <= Math.abs(sx) * angleRate);
    case 2:
    case 8:
      return (Math.abs(sy) + Math.abs(sx) <= distance &&
       Math.abs(sx) <= Math.abs(sy) * angleRate);
    default: // something wrong
      return false;
    }
  };

  Game_Character.prototype.isPlayerRangeOfView =
   function(distance, angleRate) {
    return this.isRangeOfView($gamePlayer, distance, angleRate);
  };

  //
  // this is the finding function.
  //
  Game_Character.prototype.findPlayer = function(distance, angleRate) {
    return this.isPlayerRangeOfView(distance, angleRate) &&
     this.canSeePlayer();
  };

  // ---------------------------------------
  //  initialize symbol encount settings
  // ---------------------------------------

  var _Game_Event_initMembers = Game_Event.prototype.initMembers;
  Game_Event.prototype.initMembers = function() {
    _Game_Event_initMembers.call(this);
    this.noteProcessed = false;
  };

  var _Game_Event_refresh = Game_Event.prototype.refresh;
  Game_Event.prototype.refresh = function() {
    // process note
    if (!this.noteProcessed) {
      var symId = this.event().meta.sym;
      this.isSymEnc = !!symId;    // symbol encount flag
      // setting symbol encount configurations
      if (this.isSymEnc) {
        this.SymEncVarID = Number(symId) || 0;
        this.SymEncSearchLimit = Number(this.event().meta.limit || 8);
        this.SymEncTroopID = Number(this.event().meta.troop) || 0;
        // process note : flag1
        var symFlag = Number(this.event().meta.symFlag || 3);
        symFlag = symFlag || 0; // avoid NaN
        this.SymEncIsBackHome = (symFlag & 0x01) !== 0;
        this.SymEncIsEscape = (symFlag & 0x02) !== 0;
        this.SymEncIsNoChase = (symFlag & 0x04) !== 0;
        this.SymEncCommonImage = (symFlag & 0x08) === 0;
        // process note : flag2
        var cType = Number(this.event().meta.cType || 2);
        cType = cType || 0; // avoid NaN
        this.SymEncSight = (cType & 0x07) / 4.0;
        this.SymEncListen = (cType & 0x08) !== 0;
        // set home position
        this.SymEncHomeX = this._x;
        this.SymEncHomeY = this._y;
        // flag on
        this.noteProcessed = true;
      }
    }
    if(this.isSymEnc && this.SymEncCommonImage){
      this.copyPage0ImageToAllPages();
    }
    _Game_Event_refresh.call(this);
  };

  var _Game_Event_setPosition = Game_Event.prototype.setPosition;
  Game_Event.prototype.setPosition = function(x, y) {
    _Game_Event_setPosition.call(this, x, y);
    if (this.isSymEnc) {
      this.SymEncHomeX = this._x;
      this.SymEncHomeY = this._y;
    }
  };

  Game_Event.prototype.copyPage0ImageToAllPages = function(){
    var pages = this.event().pages;
    for(var i = 1; i < pages.length; i++){
      pages[i].image = pages[0].image;
    }
  };

  // ---------------------------------------
  //  process symbol encount
  // ---------------------------------------

  var _Game_Event_updateStop = Game_Event.prototype.updateStop;
  Game_Event.prototype.updateStop = function() {
    if (this.isSymEnc) { // If this event is encount symbol
      if (this._locked) {
        this.resetStopCount();
      }
      Game_Character.prototype.updateStop.call(this);
      if ($gameMap.isEventRunning()) {
        // when another event is running, stop moving.
        // ex. when the player is inspecting treasure box or talking with NPC.
      } else if(SceneManager._scene._messageWindow.isOpen()) {
        // when state removed message is displaying, stop moving.
      } else {
        if (this.checkStop(this.stopCountThreshold())) {
          this.symEncUpdate();
        }
        if (!this.isMoveRouteForcing()) {
          this.updateSelfMovement();
        }
      }
    } else {
      _Game_Event_updateStop.call(this);
    }
  };

  Game_Event.prototype.symEncUpdate = function() {
    switch (this.symEncCurrentState()) {
    case 0:
      this.symEncUpdateSearch();
      break;
    case 2:
      this.symEncUpdateChase();
      break;
    case 6:
      this.symEncUpdateGoHome();
      break;
    case 7:
      this.symEncUpdateEscape();
      break;
    default:
      break;
    }
  };

  Game_Event.prototype.symEncCurrentState = function() {
    return $gameVariables.value(this.SymEncVarID);
  };

  Game_Event.prototype.symEncTransit = function(newStateId) {
    $gameVariables.setValue(this.SymEncVarID, newStateId);
    // when the symbol back home, set original direction
    if(newStateId == 0 && this.SymEncIsBackHome){
      this._direction = this.event().pages[0].image.direction;
    }
  };

  // overwritten!
  Game_Event.prototype.searchLimit = function() {
    return this.SymEncSearchLimit || 8;
  };

  Game_Event.prototype.manhattanFromPlayer = function() {
    var sx = Math.abs(this.deltaXFrom($gamePlayer.x));
    var sy = Math.abs(this.deltaYFrom($gamePlayer.y));
    return sx + sy;
  };

  //
  // State 0 (Normal/Search)
  //
  Game_Event.prototype.symEncUpdateSearch = function() {
    // using finding routine 'findPlayer'
    if (!this.SymEncIsNoChase &&
     ((this.SymEncListen && this.canListenPlayer()) ||
     this.findPlayer(this.SymEncSearchLimit, this.SymEncSight))) {
      this.symEncTransit(1);
    }
    if (this._moveType == 0) { // default : self move route is not set
      this.resetStopCount();
    }
  };

  Game_Event.prototype.canListenPlayer = function() {
    return this.manhattanFromPlayer() <=
      Math.max(this.SymEncSearchLimit, 6) / 2;
  };

  //
  // State 1 (find) : decide whether the symbol chase or escape.
  //
  Game_Event.prototype.symEncToEscapeOrNot = function(troopId){
    // this is based on their agility. It may be many other better ways.
    $gameTroop.setup(troopId);
    var f = $gameParty.bare_agility() - $gameTroop.agility() >= 8;
    $gameTroop.clear();
    return f;
  };

  Game_Party.prototype.bare_agility = function() {
    var members = this.members();
    if (members.length === 0) {
      return 1;
    }
    var sum = members.reduce(function(r, member) {
      return r + member.bare_agi();
    }, 0);
    return sum / members.length;
  };

  // actor's agility without enhancement by equipment and buff and so on.
  Game_Actor.prototype.bare_agi = function() {
    return this.paramBase(6);
  };

  //
  // State 2 (Chase)
  //
  Game_Event.prototype.symEncUpdateChase = function() {
    if (this._moveType == 0) { // default : self move route is not set
      var d = this.findDirectionTo($gamePlayer.x, $gamePlayer.y);
      if (d != 0) {
        this.moveStraight(d);
      } else {
        this.resetStopCount();
      }
    } else {
      // moving process is treated at self movement routine.
    }
    if (this.keepDistanceFromPlayer()) { // miss the player
      this.symEncTransit(5);
    }
  };

  Game_Event.prototype.keepDistanceFromPlayer = function() {
    return this.manhattanFromPlayer() >=
     Math.max(this.SymEncSearchLimit, 8) * 1.5;
  };

  //
  // State 3 (Battle)
  //
  var _Game_Interpreter_command301 = Game_Interpreter.prototype.command301;
  Game_Interpreter.prototype.command301 = function() {
    var theEvent = !$gameParty.inBattle() ? $gameMap._events[this._eventId] :
     null;
    var isSymEnc = !!theEvent && theEvent.isSymEnc;
    if (isSymEnc && !!theEvent.SymEncTroopID) {
      var troopId = theEvent.SymEncTroopID;
      if ($dataTroops[troopId]) {
        BattleManager.setup(troopId, this._params[2], this._params[3]);
        BattleManager.setEventCallback(function(n) {
          this._branch[this._indent] = n;
        }.bind(this));
        $gamePlayer.makeEncounterCount();
        SceneManager.push(Scene_Battle);
      }
      return true;
    } else {
      return _Game_Interpreter_command301.call(this);
    }
  };

  //
  // State 6 (Go Home)
  //
  Game_Event.prototype.symEncUpdateGoHome = function() {
    if (!this.SymEncIsNoChase &&
     ((this.SymEncListen && this.canListenPlayer()) ||
     this.findPlayer(this.SymEncSearchLimit, this.SymEncSight))) {
      this.symEncTransit(1);
      return;
    }
    // search the way to back home
    var tmp = this.SymEncSearchLimit;
    this.SymEncSearchLimit *= 1.5;
    var d = this.findDirectionTo(this.SymEncHomeX, this.SymEncHomeY);
    if (d != 0) {
      this.moveStraight(d);
    } else { // back home, or give up to go gome.
      this.symEncTransit(0);
    }
    this.SymEncSearchLimit = tmp;
  };

  //
  // State 7 (Escape)
  //
  Game_Event.prototype.symEncUpdateEscape = function() {
    if (this.keepDistanceFromPlayer()) { // escape success.
      this.symEncTransit(this.SymEncIsBackHome ? 6 : 0);
      return;
    }
    if (this._moveType == 0) { // default : self move route is not set
      this.moveAwayFromPlayer();
    } else {
      // moving process is at self movement routine.(ex.away from player)
    }
  };

  var _Game_Event_moveAwayFromCharacter =
   Game_Event.prototype.moveAwayFromCharacter;
  Game_Event.prototype.moveAwayFromCharacter = function(character) {
    if (this.isSymEnc) {
      var sx = this.deltaXFrom(character.x);
      var sy = this.deltaYFrom(character.y);
      if (Math.abs(sx) > Math.abs(sy)) {
        this.moveStraight(sx > 0 ? 6 : 4);
        if (!this.isMovementSucceeded()) {
          if (sy !== 0){
            this.moveStraight(sy > 0 ? 2 : 8);
          } else { // even if the same Y-coord, try moving to go away.
            this.moveStraight(8);
            if (!this.isMovementSucceeded()) {
              this.moveStraight(2);
            }
          }
        }
      } else if (sy !== 0) {
        this.moveStraight(sy > 0 ? 2 : 8);
        if (!this.isMovementSucceeded()) {
          if (sx !== 0) {
            this.moveStraight(sx > 0 ? 6 : 4);
          } else {  // even if the same X-coord, try moving to go away.
            this.moveStraight(4);
            if (!this.isMovementSucceeded()) {
              this.moveStraight(6);
            }
          }
        }
      }
    } else {
      _Game_Event_moveAwayFromCharacter.call(this, character);
    }
  };

})();
