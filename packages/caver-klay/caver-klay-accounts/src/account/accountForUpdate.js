/*
    Copyright 2019 The caver-js Authors
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

const isValidRole = require('../../../../caver-utils').isValidRole
const isValidPublicKey = require('../../../../caver-utils').isValidPublicKey

class AccountForUpdate {
    constructor(address, keyForUpdate, options) {
        this.address = address
        this.keyForUpdate = keyFormatter(keyForUpdate, options)
    }

    fillUpdateObject(updateObject) {
        delete updateObject.key
        Object.assign(updateObject, this.keyForUpdate)
    }
}

function keyFormatter(keyForUpdate, options) {
    const keyObject = {}

    if (typeof keyForUpdate === 'string') {
        if (options) throw new Error('Failed to keyFormatter for AccountForUpdate: AccountKeyPublic/legacyKey/failKey cannot have options')
        switch (keyForUpdate) {
            case 'legacyKey':
                keyObject.legacyKey = true
                break
            case 'failKey':
                keyObject.failKey = true
                break
            default:
                if (!isValidPublicKey(keyForUpdate)) throw new Error('Invalid public key')
                keyObject.publicKey = keyForUpdate
                break
        }
    } else if (Array.isArray(keyForUpdate)) {
        if (!options || !options.threshold || !options.weight)
            throw new Error('For AccountKeyMultiSig, threshold and weight should be defined in options object.')
        if (!Array.isArray(options.weight)) throw new Error('The weight should be defined as a array.')
        if (options.weight.length !== keyForUpdate.length)
            throw new Error('The length of keys in AccountKeyMultiSig and the length of weight array do not match.')

        keyObject.multisig = {
            threshold: options.threshold,
            keys: [],
        }

        let weightSum = 0

        for (let i = 0; i < keyForUpdate.length; i++) {
            const key = keyForUpdate[i]
            if (!isValidPublicKey(key)) throw new Error('Invalid public key')
            keyObject.multisig.keys.push({
                weight: options.weight[i],
                publicKey: key,
            })
            weightSum += options.weight[i]
        }

        if (weightSum < options.threshold)
            throw new Error('Invalid options for AccountKeyMultiSig: The sum of weights is less than the threshold.')
    } else {
        for (const key in keyForUpdate) {
            if (!isValidRole(key)) throw new Error(`Invalid role is defined: ${key}`)
            options = options || {}
            if (key === 'transactionKey') {
                keyObject.roleTransactionKey = keyFormatter(keyForUpdate[key], options.transactionKey)
            }
            if (key === 'updateKey') {
                keyObject.roleAccountUpdateKey = keyFormatter(keyForUpdate[key], options.updateKey)
            }
            if (key === 'feePayerKey') {
                keyObject.roleFeePayerKey = keyFormatter(keyForUpdate[key], options.feePayerKey)
            }
        }
    }

    return keyObject
}

module.exports = AccountForUpdate
