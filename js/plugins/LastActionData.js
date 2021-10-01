//=============================================================================
// LastActionData.js
//=============================================================================
/*:ja
 * @plugindesc 直前の行動の情報を取得するメソッドを追加します。
 *
 *
 * @help このプラグインには、プラグインコマンドはありません。
 *
 * 以下のスクリプトを実行すると直前の状態を取得できます。
 * $gameTemp.lastActionData(0) // 直前に使用したスキルのID
 * $gameTemp.lastActionData(1) // 直前に使用したアイテムのID
 * $gameTemp.lastActionData(2) // 直前に行動したアクターのID
 * $gameTemp.lastActionData(3) // 直前に行動した敵キャラのインデックス
 * $gameTemp.lastActionData(4) // 直前に対象となったアクターのID
 * $gameTemp.lastActionData(5) // 直前に対象となった敵キャラのインデックス
*/
(() => {
	"use strict";

	//=============================================================================
	// Game_Temp
	//=============================================================================
	const _Game_Temp_initialize = Game_Temp.prototype.initialize;
	Game_Temp.prototype.initialize = function() {
		_Game_Temp_initialize.apply(this, arguments);
		this._lastActionData = [0, 0, 0, 0, 0, 0];
	};

	Game_Temp.prototype.lastActionData = function(type) {
		return this._lastActionData[type] || 0;
	};

	Game_Temp.prototype.setLastActionData = function(type, value) {
		this._lastActionData[type] = value;
	};

	Game_Temp.prototype.setLastUsedSkillId = function(skillID) {
		this.setLastActionData(0, skillID);
	};

	Game_Temp.prototype.setLastUsedItemId = function(itemID) {
		this.setLastActionData(1, itemID);
	};

	Game_Temp.prototype.setLastSubjectActorId = function(actorID) {
		this.setLastActionData(2, actorID);
	};

	Game_Temp.prototype.setLastSubjectEnemyIndex = function(enemyIndex) {
		this.setLastActionData(3, enemyIndex);
	};

	Game_Temp.prototype.setLastTargetActorId = function(actorID) {
		this.setLastActionData(4, actorID);
	};

	Game_Temp.prototype.setLastTargetEnemyIndex = function(enemyIndex) {
		this.setLastActionData(5, enemyIndex);
	};

	//=============================================================================
	// Game_Action
	//=============================================================================
	const _Game_Action_apply = Game_Action.prototype.apply;
	Game_Action.prototype.apply = function(target) {
		_Game_Action_apply.apply(this, arguments);
		this.updateLastTarget(target);
	};

	const _Game_Action_applyGlobal = Game_Action.prototype.applyGlobal;
	Game_Action.prototype.applyGlobal = function() {
		_Game_Action_applyGlobal.apply(this, arguments);
		this.updateLastUsed();
		this.updateLastSubject();
	};

	Game_Action.prototype.updateLastUsed = function() {
		const item = this.item();
		if (DataManager.isSkill(item)) {
			$gameTemp.setLastUsedSkillId(item.id);
		} else if (DataManager.isItem(item)) {
			$gameTemp.setLastUsedItemId(item.id);
		}
	};

	Game_Action.prototype.updateLastSubject = function() {
		const subject = this.subject();
		if (subject.isActor()) {
			$gameTemp.setLastSubjectActorId(subject.actorId());
		} else {
			$gameTemp.setLastSubjectEnemyIndex(subject.index() + 1);
		}
	};

	Game_Action.prototype.updateLastTarget = function(target) {
		if (target.isActor()) {
			$gameTemp.setLastTargetActorId(target.actorId());
		} else {
			$gameTemp.setLastTargetEnemyIndex(target.index() + 1);
		}
	};

})();