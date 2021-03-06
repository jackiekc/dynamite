var common = require('./common')
var typ = require('typ')
var util = require('util')
var DynamoRequest = require('./DynamoRequest')
var DynamoResponse = require('./DynamoResponse')
var Builder = require('./Builder')
var localUpdater = require('./localUpdater')
var typeUtil = require('./typeUtil')

/**
 * @param {Object} options
 * @constructor
 * @extends {Builder}
 */
function UpdateBuilder(options) {
  Builder.call(this, options)

  /** @private {!Object.<?>} */
  this._attributeUpdates = {}

  /** @private {boolean} */
  this._enabledUpsert = false
}
util.inherits(UpdateBuilder, Builder)

UpdateBuilder.prototype.enableUpsert = function () {
  this._enabledUpsert = true
  return this
}

/**
 * @param {string} key
 * @param {boolean|number|string|Array.<number>|Array.<string>} val
 */
UpdateBuilder.prototype.putAttribute = function (key, val) {
  if (typ.isNullish(key)) throw new Error("Key must be defined")
  if (typ.isNullish(val)) throw new Error("Val must be defined")
  this._attributeUpdates[key] = {
    Value: typeUtil.valueToObject(val),
    Action: 'PUT'
  }
  return this
}

/**
 * @param {string} key
 * @param {number|string|Array.<number>|Array.<string>} val
 */
UpdateBuilder.prototype.addToAttribute = function (key, val) {
  if (typ.isNullish(key)) throw new Error("Key must be defined")
  if (typ.isNullish(val)) throw new Error("Val must be defined")
  this._attributeUpdates[key] = {
    Value: typeUtil.valueToObject(val),
    Action: 'ADD'
  }
  return this
}

/**
 * @param {string} key
 * @param {number|string|Array.<number>|Array.<string>} val
 */
UpdateBuilder.prototype.deleteFromAttribute = function (key, val) {
  if (typ.isNullish(key)) throw new Error("Key must be defined")
  if (typ.isNullish(val)) throw new Error("Val must be defined")

  this._attributeUpdates[key] = {
    Value: typeUtil.valueToObject(val),
    Action: 'DELETE'
  }
  return this
}

UpdateBuilder.prototype.deleteAttribute = function (key) {
  if (typ.isNullish(key)) throw new Error("Key must be defined")
  this._attributeUpdates[key] = {
    Action: 'DELETE'
  }
  return this
}

/** @override */
UpdateBuilder.prototype.prepareOutput = function (output) {
  var attributes = output.Attributes
  if (!attributes) {
    attributes = {}
    attributes[this._hashKey.name] = typeUtil.valueToObject(this._hashKey.val)
    if (this._rangeKey) {
      attributes[this._rangeKey.name] = typeUtil.valueToObject(this._rangeKey.val)
    }
  }

  output.UpdatedAttributes = localUpdater.update(attributes, this._attributeUpdates)
  return new DynamoResponse(this.getPrefix(), output, null)
}

UpdateBuilder.prototype.execute = function () {
  var self = this
  var req = new DynamoRequest(this.getOptions())
    .setTable(this._tablePrefix, this._table)
    .returnConsumedCapacity()
    .setHashKey(this._hashKey, true)
    .setUpdates(this._attributeUpdates)
    .setExpected(this._conditions)
    .setReturnValues('ALL_OLD')

  if (this._rangeKey) req.setRangeKey(this._rangeKey, true)

  var queryData = req.build()

  if ((!this._conditions || !this._conditions.length) && !this._enabledUpsert) {
    console.warn("Update issued without conditions or .enableUpsert() called")
    console.trace()
  }
  return this.request("updateItem", queryData)
    .then(this.prepareOutput.bind(this))
    .failBound(this.convertErrors, null, {data: queryData, isWrite: true})
}

module.exports = UpdateBuilder
