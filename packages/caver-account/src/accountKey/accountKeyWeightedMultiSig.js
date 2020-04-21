/*
    Copyright 2020 The caver-js Authors
    This file is part of the caver-js library.

    The caver-js library is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    The caver-js library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with the caver-js. If not, see <http://www.gnu.org/licenses/>.
*/

const _ = require('lodash')
const RLP = require('eth-lib/lib/rlp')
const Bytes = require('eth-lib/lib/bytes')
const WeightedPublicKey = require('./weightedPublicKey')
const utils = require('../../../caver-utils')
const { ACCOUNT_KEY_TAG } = require('./accountKeyHelper')

/**
 * Representing an AccountKeyWeightedMultiSig.
 * @class
 */
class AccountKeyWeightedMultiSig {
    /**
     * Decodes an RLP-encoded AccountKeyWeightedMultiSig string.
     * @param {string} rlpEncodedKey - An RLP-encoded AccountKeyWeightedMultiSig string.
     * @return {AccountKeyWeightedMultiSig}
     */
    static decode(rlpEncodedKey) {
        rlpEncodedKey = utils.addHexPrefix(rlpEncodedKey)
        if (!rlpEncodedKey.startsWith(ACCOUNT_KEY_TAG.ACCOUNT_KEY_WEIGHTED_MULTISIG_TAG))
            throw new Error(
                `Cannot decode to AccountKeyWeightedMultiSig. The prefix must be ${ACCOUNT_KEY_TAG.ACCOUNT_KEY_WEIGHTED_MULTISIG_TAG}: ${rlpEncodedKey}`
            )

        const [threshold, multiSigkeys] = RLP.decode(`0x${rlpEncodedKey.slice(ACCOUNT_KEY_TAG.ACCOUNT_KEY_WEIGHTED_MULTISIG_TAG.length)}`)
        const weightedPublicKeys = multiSigkeys.map(weightedPublicKey => {
            return new WeightedPublicKey(weightedPublicKey[0], weightedPublicKey[1])
        })
        return new AccountKeyWeightedMultiSig(threshold, weightedPublicKeys)
    }

    /**
     * Creates an instance of AccountKeyWeighedMultiSig.
     * @param {Array.<string>} publicKeyArray - An array of public key strings.
     * @param {object} options - An options which defines threshold and weight.
     * @return {AccountKeyWeightedMultiSig}
     */
    static fromPublicKeysAndOptions(publicKeyArray, options) {
        if (options === undefined || options.threshold === undefined || options.weight === undefined) {
            throw new Error(
                `Invalid options object. For AccountKeyWeightedMultiSig, the second parameter 'options' should be defined.`
            )
        }
        if (!_.isArray(options.weight)) throw new Error(`weight should be an array that stores the weight of each public key.`)
        if (publicKeyArray.length !== options.weight.length) {
            throw new Error(`The length of public keys and the length of weight array do not match.`)
        }

        const weightedPublicKeys = []
        let weightSum = 0

        for (let i = 0; i < publicKeyArray.length; i++) {
            const weightedPublicKey = new WeightedPublicKey(options.weight[i], publicKeyArray[i])
            weightedPublicKeys.push(weightedPublicKey)
            weightSum += options.weight[i]
        }

        if (weightSum < options.threshold) {
            throw new Error('Invalid options for AccountKeyWeightedMultiSig: The sum of weights is less than the threshold.')
        }

        return new AccountKeyWeightedMultiSig(options.threshold, weightedPublicKeys)
    }

    /**
     * Create an instance of AccountKeyWeightedMultiSig.
     * @param {number} threshold - The threshold of accountKey.
     * @param {Array.<WeightedPublicKey>} weightedPublicKeys - An array of instances of WeightedPublicKeys
     */
    constructor(threshold, weightedPublicKeys) {
        this._threshold = utils.hexToNumber(threshold)

        for (const wp of weightedPublicKeys) {
            if (!(wp instanceof WeightedPublicKey)) throw new Error(`Invalid type of weighted public keys.`)
        }
        this._weightedPublicKeys = weightedPublicKeys || []
    }

    /**
     * @type {Number}
     */
    get threshold() {
        return this._threshold
    }

    set threshold(t) {
        this._threshold = utils.hexToNumber(t)
    }

    /**
     * @type {Array.<WeightedPublicKey>}
     */
    get weightedPublicKeys() {
        return this._weightedPublicKeys
    }

    set weightedPublicKeys(wps) {
        for (const wp of wps) {
            if (!(wp instanceof WeightedPublicKey)) throw new Error(`Invalid type of weighted public keys.`)
        }
        this._weightedPublicKeys = wps
    }

    /**
     * Returns an RLP-encoded AccountKeyWeightedMultiSig string.
     * @return {string}
     */
    getRLPEncoding() {
        if (this.threshold === undefined) throw new Error('threshold should be specified for a multisig account')
        if (this.weightedPublicKeys.length === 0) throw new Error('weightedPublicKeys should be specified for a multisig account')

        const encodedMultisigPublicKeys = []
        for (const weightedPublicKey of this.weightedPublicKeys) {
            encodedMultisigPublicKeys.push(weightedPublicKey.encodeToBytes())
        }

        return (
            ACCOUNT_KEY_TAG.ACCOUNT_KEY_WEIGHTED_MULTISIG_TAG +
            RLP.encode([Bytes.fromNat(utils.numberToHex(this.threshold)), encodedMultisigPublicKeys]).slice(2)
        )
    }
}

module.exports = AccountKeyWeightedMultiSig
