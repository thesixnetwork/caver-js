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

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
const chaiAsPromised = require('chai-as-promised')

const RLP = require('eth-lib/lib/rlp')

chai.use(chaiAsPromised)
chai.use(sinonChai)

const expect = chai.expect

const { propertiesForUnnecessary } = require('../utils')

const testRPCURL = require('../../testrpc')
const Caver = require('../../../index.js')
const Keyring = require('../../../packages/caver-wallet/src/keyring/keyring')
const TransactionHasher = require('../../../packages/caver-transaction/src/transactionHasher/transactionHasher')

const { generateRoleBasedKeyring, checkSignature, checkFeePayerSignature } = require('../utils')

const AbstractTransaction = require('../../../packages/caver-transaction/src/transactionTypes/abstractTransaction')

let caver
let sender
let roleBasedKeyring

const txWithExpectedValues = {}

const sandbox = sinon.createSandbox()

const input =
    '0xf8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a00000000000000000000000000000000000000000000000000000000000000004058006'

before(() => {
    caver = new Caver(testRPCURL)
    AbstractTransaction._klaytnCall = {
        getGasPrice: () => {},
        getTransactionCount: () => {},
        getChainId: () => {},
    }

    sender = caver.wallet.add(caver.wallet.keyring.generate())
    roleBasedKeyring = generateRoleBasedKeyring([3, 3, 3])

    txWithExpectedValues.tx = {
        from: '0xa94f5374Fce5edBC8E2a8697C15331677e6EbF0B',
        gas: '0x174876e800',
        gasPrice: '0x5d21dba00',
        feeRatio: 88,
        chainId: '0x1',
        nonce: 18,
        input,
        signatures: [
            [
                '0x26',
                '0xc612a243bcb3b98958e9cce1a0bc0e170291b33a7f0dbfae4b36dafb5806797d',
                '0xc734423492ecc21cc53238147c359676fcec43fcc2a0e021d87bb1da49f0abf',
            ],
        ],
        feePayer: '0x33f524631e573329a550296F595c820D6c65213f',
        feePayerSignatures: [
            [
                '0x25',
                '0xa3e40598b67e2bcbaa48fdd258b9d1dcfcc9cc134972560ba042430078a769a5',
                '0x6707ea362e588e4e5869cffcd5a058749d823aeff13eb95dc1146faff561df32',
            ],
        ],
    }
    txWithExpectedValues.rlpEncodingForSigning =
        '0xf8dcb8d7f8d54a128505d21dba0085174876e80094a94f5374fce5edbc8e2a8697c15331677e6ebf0bb8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a0000000000000000000000000000000000000000000000000000000000000000405800658018080'
    txWithExpectedValues.rlpEncodingForFeePayerSigning =
        '0xf8f1b8d7f8d54a128505d21dba0085174876e80094a94f5374fce5edbc8e2a8697c15331677e6ebf0bb8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a00000000000000000000000000000000000000000000000000000000000000004058006589433f524631e573329a550296f595c820d6c65213f018080'
    txWithExpectedValues.senderTxHash = '0xa0670c01fe39feb2d2442adf7df1957ade3c5abcde778fb5edf99c80c06aa53c'
    txWithExpectedValues.transactionHash = '0xc01a7c3ece18c115b58d7747669ec7c31ec5ab031a88cb49ad85a31f6dbbf915'
    txWithExpectedValues.rlpEncoding =
        '0x4af90177128505d21dba0085174876e80094a94f5374fce5edbc8e2a8697c15331677e6ebf0bb8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a0000000000000000000000000000000000000000000000000000000000000000405800658f845f84326a0c612a243bcb3b98958e9cce1a0bc0e170291b33a7f0dbfae4b36dafb5806797da00c734423492ecc21cc53238147c359676fcec43fcc2a0e021d87bb1da49f0abf9433f524631e573329a550296f595c820d6c65213ff845f84325a0a3e40598b67e2bcbaa48fdd258b9d1dcfcc9cc134972560ba042430078a769a5a06707ea362e588e4e5869cffcd5a058749d823aeff13eb95dc1146faff561df32'
})

describe('TxTypeFeeDelegatedChainDataAnchoringWithRatio', () => {
    let transactionObj
    let getGasPriceSpy
    let getNonceSpy
    let getChainIdSpy
    beforeEach(() => {
        transactionObj = {
            from: sender.address,
            gas: '0x15f90',
            input,
            feeRatio: 30,
        }

        getGasPriceSpy = sandbox.stub(AbstractTransaction._klaytnCall, 'getGasPrice')
        getGasPriceSpy.returns('0x5d21dba00')
        getNonceSpy = sandbox.stub(AbstractTransaction._klaytnCall, 'getTransactionCount')
        getNonceSpy.returns('0x3a')
        getChainIdSpy = sandbox.stub(AbstractTransaction._klaytnCall, 'getChainId')
        getChainIdSpy.returns('0x7e3')
    })

    afterEach(() => {
        sandbox.restore()
    })

    context('create feeDelegatedChainDataAnchoringWithRatio instance', () => {
        it('CAVERJS-UNIT-TRANSACTIONFD-448: If feeDelegatedChainDataAnchoringWithRatio not define from, return error', () => {
            delete transactionObj.from

            const expectedError = '"from" is missing'
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-449: If feeDelegatedChainDataAnchoringWithRatio not define gas, return error', () => {
            delete transactionObj.gas

            const expectedError = '"gas" is missing'
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-450: If feeDelegatedChainDataAnchoringWithRatio not define input, return error', () => {
            delete transactionObj.input

            const expectedError = '"input" is missing'
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-451: If feeDelegatedChainDataAnchoringWithRatio not define feeRatio, return error', () => {
            delete transactionObj.feeRatio

            const expectedError = '"feeRatio" is missing'
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-452: If feeDelegatedChainDataAnchoringWithRatio define from property with invalid address, return error', () => {
            transactionObj.from = 'invalid'

            const expectedError = `Invalid address of from: ${transactionObj.from}`
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-453: If feeDelegatedChainDataAnchoringWithRatio define feePayer property with invalid address, return error', () => {
            transactionObj.feePayer = 'invalid'

            const expectedError = `Invalid address of fee payer: ${transactionObj.feePayer}`
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFDR-523: If feeDelegatedChainDataAnchoringWithRatio define feeRatio property with invalid value, return error', () => {
            transactionObj.feeRatio = 'nonHexString'
            let expectedError = `Invalid type fo feeRatio: feeRatio should be number type or hex number string.`
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = {}
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = []
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = 0
            expectedError = `Invalid feeRatio: feeRatio is out of range. [1, 99]`
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = 100
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = -1
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)

            transactionObj.feeRatio = 101
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-454: If feeDelegatedChainDataAnchoringWithRatio define feePayerSignatures property without feePayer, return error', () => {
            transactionObj.feePayerSignatures = [
                [
                    '0x26',
                    '0xf45cf8d7f88c08e6b6ec0b3b562f34ca94283e4689021987abb6b0772ddfd80a',
                    '0x298fe2c5aeabb6a518f4cbb5ff39631a5d88be505d3923374f65fdcf63c2955b',
                ],
            ]

            const expectedError = '"feePayer" is missing: feePayer must be defined with feePayerSignatures.'
            expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-455: If feeDelegatedChainDataAnchoringWithRatio define unnecessary property, return error', () => {
            const unnecessaries = [
                propertiesForUnnecessary.to,
                propertiesForUnnecessary.value,
                propertiesForUnnecessary.codeFormat,
                propertiesForUnnecessary.failKey,
                propertiesForUnnecessary.account,
                propertiesForUnnecessary.key,
                propertiesForUnnecessary.legacyKey,
                propertiesForUnnecessary.publicKey,
                propertiesForUnnecessary.failKey,
                propertiesForUnnecessary.multisig,
                propertiesForUnnecessary.roleTransactionKey,
                propertiesForUnnecessary.roleAccountUpdateKey,
                propertiesForUnnecessary.roleFeePayerKey,
                propertiesForUnnecessary.humanReadable,
            ]

            for (let i = 0; i < unnecessaries.length; i++) {
                if (i > 0) delete transactionObj[unnecessaries[i - 1].name]
                transactionObj[unnecessaries[i].name] = unnecessaries[i].value

                const expectedError = `"${unnecessaries[i].name}" cannot be used with ${caver.transaction.type.TxTypeFeeDelegatedChainDataAnchoringWithRatio} transaction`
                // eslint-disable-next-line no-loop-func
                expect(() => new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)).to.throw(expectedError)
            }
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getRLPEncoding', () => {
        it('CAVERJS-UNIT-TRANSACTIONFD-456: Returns RLP-encoded string', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)

            expect(tx.getRLPEncoding()).to.equal(txWithExpectedValues.rlpEncoding)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-457: getRLPEncoding should throw error when nonce is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._nonce

            const expectedError = `nonce is undefined. Define nonce in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncoding()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-458: getRLPEncoding should throw error when gasPrice is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._gasPrice

            const expectedError = `gasPrice is undefined. Define gasPrice in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncoding()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-459: getRLPEncoding should throw error when chainId is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._chainId

            const expectedError = `chainId is undefined. Define chainId in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncoding()).to.throw(expectedError)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.signWithKey', () => {
        const txHash = '0xe9a11d9ef95fb437f75d07ce768d43e74f158dd54b106e7d3746ce29d545b550'

        let fillTransactionSpy
        let createFromPrivateKeySpy
        let senderSignWithKeySpy
        let appendSignaturesSpy
        let hasherSpy
        let tx

        beforeEach(() => {
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            fillTransactionSpy = sandbox.spy(tx, 'fillTransaction')
            createFromPrivateKeySpy = sandbox.spy(Keyring, 'createFromPrivateKey')
            senderSignWithKeySpy = sandbox.spy(sender, 'signWithKey')
            appendSignaturesSpy = sandbox.spy(tx, 'appendSignatures')
            hasherSpy = sandbox.stub(TransactionHasher, 'getHashForSignature')
            hasherSpy.returns(txHash)
        })

        afterEach(() => {
            sandbox.restore()
        })

        function checkFunctionCall(customHasher = false) {
            expect(fillTransactionSpy).to.have.been.calledOnce
            expect(appendSignaturesSpy).to.have.been.calledOnce
            if (!customHasher) expect(hasherSpy).to.have.been.calledWith(tx)
        }

        it('CAVERJS-UNIT-TRANSACTIONFD-460: input: keyring. should sign transaction.', async () => {
            await tx.signWithKey(sender)

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeySpy).to.have.been.calledWith(txHash, '0x7e3', 0, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-461: input: private key string. should sign transaction.', async () => {
            const signWithKeyProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKey')
            await tx.signWithKey(sender.keys[0][0].privateKey)

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeyProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 0, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-462: input: KlaytnWalletKey. should sign transaction.', async () => {
            const signWithKeyProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKey')
            await tx.signWithKey(sender.getKlaytnWalletKey())

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeyProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 0, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-463: input: keyring, index. should sign transaction with specific index.', async () => {
            const roleBasedSignWithKeySpy = sandbox.spy(roleBasedKeyring, 'signWithKey')

            tx.from = roleBasedKeyring.address

            await tx.signWithKey(roleBasedKeyring, 1)

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeySpy).to.have.been.calledWith(txHash, '0x7e3', 0, 1)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-464: input: keyring, custom hasher. should throw error.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            const expectedError = `In order to pass a custom hasher, use the third parameter.`
            await expect(tx.signWithKey(sender, customHasher)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-465: input: keyring, index, custom hasher. should use custom hasher when sign transaction.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            const roleBasedSignWithKeySpy = sandbox.spy(roleBasedKeyring, 'signWithKey')

            tx.from = roleBasedKeyring.address

            await tx.signWithKey(roleBasedKeyring, 1, customHasher)

            checkFunctionCall(true)
            checkSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeySpy).to.have.been.calledWith(hashForCustomHasher, '0x7e3', 0, 1)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-466: input: keyring. should throw error when from is different.', async () => {
            transactionObj.from = roleBasedKeyring.address
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const expectedError = `The from address of the transaction is different with the address of the keyring to use.`
            await expect(tx.signWithKey(sender)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-467: input: rolebased keyring, index out of range. should throw error.', async () => {
            transactionObj.from = roleBasedKeyring.address
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const expectedError = `Invalid index(10): index must be less than the length of keys(${roleBasedKeyring.keys[0].length}).`
            await expect(tx.signWithKey(roleBasedKeyring, 10)).to.be.rejectedWith(expectedError)
        }).timeout(200000)
    })

    context('feeDelegatedChainDataAnchoringWithRatio.signFeePayerWithKey', () => {
        const txHash = '0xe9a11d9ef95fb437f75d07ce768d43e74f158dd54b106e7d3746ce29d545b550'

        let fillTransactionSpy
        let createFromPrivateKeySpy
        let senderSignWithKeySpy
        let appendSignaturesSpy
        let hasherSpy
        let tx

        beforeEach(() => {
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)
            tx.feePayer = sender.address

            fillTransactionSpy = sandbox.spy(tx, 'fillTransaction')
            createFromPrivateKeySpy = sandbox.spy(Keyring, 'createFromPrivateKey')
            senderSignWithKeySpy = sandbox.spy(sender, 'signWithKey')
            appendSignaturesSpy = sandbox.spy(tx, 'appendFeePayerSignatures')
            hasherSpy = sandbox.stub(TransactionHasher, 'getHashForFeePayerSignature')
            hasherSpy.returns(txHash)
        })

        afterEach(() => {
            sandbox.restore()
        })

        function checkFunctionCall(customHasher = false) {
            expect(fillTransactionSpy).to.have.been.calledOnce
            expect(appendSignaturesSpy).to.have.been.calledOnce
            if (!customHasher) expect(hasherSpy).to.have.been.calledWith(tx)
        }

        it('CAVERJS-UNIT-TRANSACTIONFD-468: input: keyring. If feePayer is not defined, should be set with keyring address.', async () => {
            tx.feePayer = '0x'
            await tx.signFeePayerWithKey(sender)

            expect(tx.feePayer.toLowerCase()).to.equal(sender.address.toLowerCase())
            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeySpy).to.have.been.calledWith(txHash, '0x7e3', 2, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-469: input: keyring. should sign transaction.', async () => {
            await tx.signFeePayerWithKey(sender)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeySpy).to.have.been.calledWith(txHash, '0x7e3', 2, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-470: input: private key string. should sign transaction.', async () => {
            const signWithKeyProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKey')
            await tx.signFeePayerWithKey(sender.keys[0][0].privateKey)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeyProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 2, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-471: input: KlaytnWalletKey. should sign transaction.', async () => {
            const signWithKeyProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKey')
            await tx.signFeePayerWithKey(sender.getKlaytnWalletKey())

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeyProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 2, 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-472: input: keyring, index. should sign transaction with specific index.', async () => {
            const roleBasedSignWithKeySpy = sandbox.spy(roleBasedKeyring, 'signWithKey')

            tx.feePayer = roleBasedKeyring.address

            await tx.signFeePayerWithKey(roleBasedKeyring, 1)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeySpy).to.have.been.calledWith(txHash, '0x7e3', 2, 1)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-473: input: keyring, custom hasher. should throw error.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            const expectedError = `In order to pass a custom hasher, use the third parameter.`
            await expect(tx.signFeePayerWithKey(sender, customHasher)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-474: input: keyring, index, custom hasher. should use custom hasher when sign transaction.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            const roleBasedSignWithKeySpy = sandbox.spy(roleBasedKeyring, 'signWithKey')

            tx.feePayer = roleBasedKeyring.address

            await tx.signFeePayerWithKey(roleBasedKeyring, 1, customHasher)

            checkFunctionCall(true)
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeySpy).to.have.been.calledWith(hashForCustomHasher, '0x7e3', 2, 1)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-475: input: keyring. should throw error when feePayer is different.', async () => {
            tx.feePayer = roleBasedKeyring.address

            const expectedError = `The feePayer address of the transaction is different with the address of the keyring to use.`
            await expect(tx.signFeePayerWithKey(sender)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-476: input: rolebased keyring, index out of range. should throw error.', async () => {
            transactionObj.from = roleBasedKeyring.address
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const expectedError = `Invalid index(10): index must be less than the length of keys(${roleBasedKeyring.keys[0].length}).`
            await expect(tx.signFeePayerWithKey(roleBasedKeyring, 10)).to.be.rejectedWith(expectedError)
        }).timeout(200000)
    })

    context('feeDelegatedChainDataAnchoringWithRatio.signWithKeys', () => {
        const txHash = '0xe9a11d9ef95fb437f75d07ce768d43e74f158dd54b106e7d3746ce29d545b550'

        let fillTransactionSpy
        let createFromPrivateKeySpy
        let senderSignWithKeysSpy
        let appendSignaturesSpy
        let hasherSpy
        let tx

        beforeEach(() => {
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            fillTransactionSpy = sandbox.spy(tx, 'fillTransaction')
            createFromPrivateKeySpy = sandbox.spy(Keyring, 'createFromPrivateKey')
            senderSignWithKeysSpy = sandbox.spy(sender, 'signWithKeys')
            appendSignaturesSpy = sandbox.spy(tx, 'appendSignatures')
            hasherSpy = sandbox.stub(TransactionHasher, 'getHashForSignature')
            hasherSpy.returns(txHash)
        })

        afterEach(() => {
            sandbox.restore()
        })

        function checkFunctionCall(customHasher = false) {
            expect(fillTransactionSpy).to.have.been.calledOnce
            expect(appendSignaturesSpy).to.have.been.calledOnce
            if (!customHasher) expect(hasherSpy).to.have.been.calledWith(tx)
        }

        it('CAVERJS-UNIT-TRANSACTIONFD-477: input: keyring. should sign transaction.', async () => {
            await tx.signWithKeys(sender)

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeysSpy).to.have.been.calledWith(txHash, '0x7e3', 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-478: input: private key string. should sign transaction.', async () => {
            const signWithKeysProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKeys')
            await tx.signWithKeys(sender.keys[0][0].privateKey)

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeysProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-479: input: KlaytnWalletKey. should sign transaction.', async () => {
            const signWithKeysProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKeys')
            await tx.signWithKeys(sender.getKlaytnWalletKey())

            checkFunctionCall()
            checkSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeysProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-480: input: keyring, custom hasher. should use custom hasher when sign transaction.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            await tx.signWithKeys(sender, customHasher)

            checkFunctionCall(true)
            checkSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeysSpy).to.have.been.calledWith(hashForCustomHasher, '0x7e3', 0)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-481: input: keyring. should throw error when from is different.', async () => {
            transactionObj.from = roleBasedKeyring.address
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const expectedError = `The from address of the transaction is different with the address of the keyring to use.`
            await expect(tx.signWithKeys(sender)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-482: input: roleBased keyring. should sign with multiple keys and append signatures', async () => {
            const roleBasedSignWithKeysSpy = sandbox.spy(roleBasedKeyring, 'signWithKeys')

            tx.from = roleBasedKeyring.address

            await tx.signWithKeys(roleBasedKeyring)

            checkFunctionCall(true)
            checkSignature(tx, { expectedLength: roleBasedKeyring.keys[0].length })
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeysSpy).to.have.been.calledWith(txHash, '0x7e3', 0)
        }).timeout(200000)
    })

    context('feeDelegatedChainDataAnchoringWithRatio.signFeePayerWithKeys', () => {
        const txHash = '0xe9a11d9ef95fb437f75d07ce768d43e74f158dd54b106e7d3746ce29d545b550'

        let fillTransactionSpy
        let createFromPrivateKeySpy
        let senderSignWithKeysSpy
        let appendSignaturesSpy
        let hasherSpy
        let tx

        beforeEach(() => {
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            fillTransactionSpy = sandbox.spy(tx, 'fillTransaction')
            createFromPrivateKeySpy = sandbox.spy(Keyring, 'createFromPrivateKey')
            senderSignWithKeysSpy = sandbox.spy(sender, 'signWithKeys')
            appendSignaturesSpy = sandbox.spy(tx, 'appendFeePayerSignatures')
            hasherSpy = sandbox.stub(TransactionHasher, 'getHashForFeePayerSignature')
            hasherSpy.returns(txHash)
        })

        afterEach(() => {
            sandbox.restore()
        })

        function checkFunctionCall(customHasher = false) {
            expect(fillTransactionSpy).to.have.been.calledOnce
            expect(appendSignaturesSpy).to.have.been.calledOnce
            if (!customHasher) expect(hasherSpy).to.have.been.calledWith(tx)
        }

        it('CAVERJS-UNIT-TRANSACTIONFD-483: input: keyring. If feePayer is not defined, should be set with keyring address.', async () => {
            tx.feePayer = '0x'
            await tx.signFeePayerWithKeys(sender)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeysSpy).to.have.been.calledWith(txHash, '0x7e3', 2)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-484: input: keyring. should sign transaction.', async () => {
            await tx.signFeePayerWithKeys(sender)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeysSpy).to.have.been.calledWith(txHash, '0x7e3', 2)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-485: input: private key string. should sign transaction.', async () => {
            const signWithKeysProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKeys')
            await tx.signFeePayerWithKeys(sender.keys[0][0].privateKey)

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeysProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 2)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-486: input: KlaytnWalletKey. should sign transaction.', async () => {
            const signWithKeysProtoSpy = sandbox.spy(Keyring.prototype, 'signWithKeys')
            await tx.signFeePayerWithKeys(sender.getKlaytnWalletKey())

            checkFunctionCall()
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).to.have.been.calledOnce
            expect(signWithKeysProtoSpy).to.have.been.calledWith(txHash, '0x7e3', 2)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-487: input: keyring, custom hasher. should use custom hasher when sign transaction.', async () => {
            const hashForCustomHasher = '0x9e4b4835f6ea5ce55bd1037fe92040dd070af6154aefc30d32c65364a1123cae'
            const customHasher = () => hashForCustomHasher

            await tx.signFeePayerWithKeys(sender, customHasher)

            checkFunctionCall(true)
            checkFeePayerSignature(tx)
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(senderSignWithKeysSpy).to.have.been.calledWith(hashForCustomHasher, '0x7e3', 2)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-488: input: keyring. should throw error when feePayer is different.', async () => {
            tx.feePayer = roleBasedKeyring.address

            const expectedError = `The feePayer address of the transaction is different with the address of the keyring to use.`
            await expect(tx.signFeePayerWithKeys(sender)).to.be.rejectedWith(expectedError)
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-489: input: roleBased keyring. should sign with multiple keys and append signatures', async () => {
            const roleBasedSignWithKeysSpy = sandbox.spy(roleBasedKeyring, 'signWithKeys')

            tx.feePayer = roleBasedKeyring.address

            await tx.signFeePayerWithKeys(roleBasedKeyring)

            checkFunctionCall(true)
            checkFeePayerSignature(tx, { expectedLength: roleBasedKeyring.keys[2].length })
            expect(createFromPrivateKeySpy).not.to.have.been.calledOnce
            expect(roleBasedSignWithKeysSpy).to.have.been.calledWith(txHash, '0x7e3', 2)
        }).timeout(200000)
    })

    context('feeDelegatedChainDataAnchoringWithRatio.appendSignatures', () => {
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-490: If signatures is empty, appendSignatures append signatures in transaction', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                '0x0fea',
                '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
            ]
            tx.appendSignatures(sig)
            checkSignature(tx)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-491: If signatures is empty, appendSignatures append signatures with two-dimensional signature array', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                [
                    '0x0fea',
                    '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                    '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
                ],
            ]
            tx.appendSignatures(sig)
            checkSignature(tx)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-492: If signatures is not empty, appendSignatures should append signatures', () => {
            transactionObj.signatures = [
                '0x0fea',
                '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
            ]
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                '0x0fea',
                '0x7a5011b41cfcb6270af1b5f8aeac8aeabb1edb436f028261b5add564de694700',
                '0x23ac51660b8b421bf732ef8148d0d4f19d5e29cb97be6bccb5ae505ebe89eb4a',
            ]

            tx.appendSignatures(sig)
            checkSignature(tx, { expectedLength: 2 })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-493: appendSignatures should append multiple signatures', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                [
                    '0x0fea',
                    '0xbde66cceed35a576010966338b7ded961f2c160c96f928e193b47aaf4480aa07',
                    '0x546eb193ec138523b7fd34c4f12a1a04d0f74470e8f3bbe91ce0b4ec16e7f0d2',
                ],
                [
                    '0x0fea',
                    '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                    '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
                ],
            ]

            tx.appendSignatures(sig)
            checkSignature(tx, { expectedLength: 2 })
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.appendFeePayerSignatures', () => {
        beforeEach(() => {
            transactionObj.feePayer = '0x90b3e9a3770481345a7f17f22f16d020bccfd33e'
        })
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-494: If feePayerSignatures is empty, appendFeePayerSignatures append feePayerSignatures in transaction', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                '0x0fea',
                '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
            ]
            tx.appendFeePayerSignatures(sig)
            checkFeePayerSignature(tx)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-495: If feePayerSignatures is empty, appendFeePayerSignatures append feePayerSignatures with two-dimensional signature array', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                [
                    '0x0fea',
                    '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                    '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
                ],
            ]
            tx.appendFeePayerSignatures(sig)
            checkFeePayerSignature(tx)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-496: If feePayerSignatures is not empty, appendFeePayerSignatures should append feePayerSignatures', () => {
            transactionObj.feePayerSignatures = [
                '0x0fea',
                '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
            ]
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                '0x0fea',
                '0x7a5011b41cfcb6270af1b5f8aeac8aeabb1edb436f028261b5add564de694700',
                '0x23ac51660b8b421bf732ef8148d0d4f19d5e29cb97be6bccb5ae505ebe89eb4a',
            ]

            tx.appendFeePayerSignatures(sig)
            checkFeePayerSignature(tx, { expectedLength: 2 })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-497: appendFeePayerSignatures should append multiple feePayerSignatures', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const sig = [
                [
                    '0x0fea',
                    '0xbde66cceed35a576010966338b7ded961f2c160c96f928e193b47aaf4480aa07',
                    '0x546eb193ec138523b7fd34c4f12a1a04d0f74470e8f3bbe91ce0b4ec16e7f0d2',
                ],
                [
                    '0x0fea',
                    '0xade9480f584fe481bf070ab758ecc010afa15debc33e1bd75af637d834073a6e',
                    '0x38160105d78cef4529d765941ad6637d8dcf6bd99310e165fee1c39fff2aa27e',
                ],
            ]

            tx.appendFeePayerSignatures(sig)
            checkFeePayerSignature(tx, { expectedLength: 2 })
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.combineSignatures', () => {
        beforeEach(() => {
            transactionObj = {
                from: '0xacfda1ac94468f2bda3e30a272215d0a5b5be413',
                gas: '0x249f0',
                nonce: '0x1',
                gasPrice: '0x5d21dba00',
                chainId: '0x7e3',
                input,
                feeRatio: 30,
            }
        })
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-498: combineSignatures combines single signature and sets signatures in transaction', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)
            const appendSignaturesSpy = sandbox.spy(tx, 'appendSignatures')
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const rlpEncoded =
                '0x4af90121018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef847f845820feaa01fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413a07e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c80c4c3018080'
            const combined = tx.combineSignatures([rlpEncoded])

            const expectedSignatures = [
                [
                    '0x0fea',
                    '0x1fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413',
                    '0x7e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c',
                ],
            ]

            expect(appendSignaturesSpy).to.have.been.calledOnce
            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(combined).to.equal(rlpEncoded)
            checkSignature(tx, { expectedSignatures })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-499: combineSignatures combines multiple signatures and sets signatures in transaction', () => {
            transactionObj.signatures = [
                [
                    '0x0fea',
                    '0x1fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413',
                    '0x7e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c',
                ],
            ]
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const rlpEncodedStrings = [
                '0x4af90121018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef847f845820fe9a0d52efcc22cd8bc3ae0dc0fa8b4a0c68ffda9295ed7a9ed612d4af6bcdfc04af5a067749106fce239d6669ae86e9eb389f25e3c506e9934435150774ed2776e974c80c4c3018080',
                '0x4af90121018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef847f845820feaa0ca90225e2de0caa34d9676690224028bd03cd99a76a0fa631466073a3f8f1944a02678afba3c5071e5a7a7084bcec0a12913f779a30303f81d897c862622048ab880c4c3018080',
            ]

            const appendSignaturesSpy = sandbox.spy(tx, 'appendSignatures')
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const combined = tx.combineSignatures(rlpEncodedStrings)

            const expectedRLPEncoded =
                '0x4af901af018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef8d5f845820feaa01fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413a07e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44cf845820fe9a0d52efcc22cd8bc3ae0dc0fa8b4a0c68ffda9295ed7a9ed612d4af6bcdfc04af5a067749106fce239d6669ae86e9eb389f25e3c506e9934435150774ed2776e974cf845820feaa0ca90225e2de0caa34d9676690224028bd03cd99a76a0fa631466073a3f8f1944a02678afba3c5071e5a7a7084bcec0a12913f779a30303f81d897c862622048ab880c4c3018080'

            const expectedSignatures = [
                [
                    '0x0fea',
                    '0x1fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413',
                    '0x7e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c',
                ],
                [
                    '0x0fe9',
                    '0xd52efcc22cd8bc3ae0dc0fa8b4a0c68ffda9295ed7a9ed612d4af6bcdfc04af5',
                    '0x67749106fce239d6669ae86e9eb389f25e3c506e9934435150774ed2776e974c',
                ],
                [
                    '0x0fea',
                    '0xca90225e2de0caa34d9676690224028bd03cd99a76a0fa631466073a3f8f1944',
                    '0x2678afba3c5071e5a7a7084bcec0a12913f779a30303f81d897c862622048ab8',
                ],
            ]

            expect(appendSignaturesSpy).to.have.been.callCount(rlpEncodedStrings.length)
            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(combined).to.equal(expectedRLPEncoded)
            checkSignature(tx, { expectedSignatures })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-500: combineSignatures combines single feePayerSignature and sets feePayerSignatures in transaction', () => {
            transactionObj.feePayer = '0x75d141c9dbefde51f488c8d79da55f48282a1e52'
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)
            const appendSignaturesSpy = sandbox.spy(tx, 'appendFeePayerSignatures')
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const rlpEncoded =
                '0x4af90135018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ec4c30180809475d141c9dbefde51f488c8d79da55f48282a1e52f847f845820feaa0945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3a0784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881'
            const combined = tx.combineSignatures([rlpEncoded])

            const expectedSignatures = [
                [
                    '0x0fea',
                    '0x945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3',
                    '0x784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881',
                ],
            ]

            expect(appendSignaturesSpy).to.have.been.calledOnce
            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(combined).to.equal(rlpEncoded)
            checkFeePayerSignature(tx, { expectedSignatures })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-501: combineSignatures combines multiple feePayerSignatures and sets feePayerSignatures in transaction', () => {
            transactionObj.feePayer = '0x75d141c9dbefde51f488c8d79da55f48282a1e52'
            transactionObj.feePayerSignatures = [
                [
                    '0x0fea',
                    '0x945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3',
                    '0x784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881',
                ],
            ]
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            const rlpEncodedStrings = [
                '0x4af90135018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ec4c30180809475d141c9dbefde51f488c8d79da55f48282a1e52f847f845820feaa092b2e701dea51bd0958d40d67b1a794822153a7624f35609d8f6320467067226a0161b871c857cf7ddb259e3dc76b4bad176a52b488bb9cea7198b778f3d0cb770',
                '0x4af90135018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ec4c30180809475d141c9dbefde51f488c8d79da55f48282a1e52f847f845820feaa0d67112e14b4fb00d5b0304638d665e0052e57e0d4bfa4fc00040b9e991bbd36da049eb2a9e8d2575e707631d2c3dc708152c5cbf59a52846871adbe7f8ae1add13',
            ]

            const appendSignaturesSpy = sandbox.spy(tx, 'appendFeePayerSignatures')
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const combined = tx.combineSignatures(rlpEncodedStrings)

            const expectedRLPEncoded =
                '0x4af901c3018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ec4c30180809475d141c9dbefde51f488c8d79da55f48282a1e52f8d5f845820feaa0945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3a0784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881f845820feaa092b2e701dea51bd0958d40d67b1a794822153a7624f35609d8f6320467067226a0161b871c857cf7ddb259e3dc76b4bad176a52b488bb9cea7198b778f3d0cb770f845820feaa0d67112e14b4fb00d5b0304638d665e0052e57e0d4bfa4fc00040b9e991bbd36da049eb2a9e8d2575e707631d2c3dc708152c5cbf59a52846871adbe7f8ae1add13'

            const expectedSignatures = [
                [
                    '0x0fea',
                    '0x945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3',
                    '0x784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881',
                ],
                [
                    '0x0fea',
                    '0x92b2e701dea51bd0958d40d67b1a794822153a7624f35609d8f6320467067226',
                    '0x161b871c857cf7ddb259e3dc76b4bad176a52b488bb9cea7198b778f3d0cb770',
                ],
                [
                    '0x0fea',
                    '0xd67112e14b4fb00d5b0304638d665e0052e57e0d4bfa4fc00040b9e991bbd36d',
                    '0x49eb2a9e8d2575e707631d2c3dc708152c5cbf59a52846871adbe7f8ae1add13',
                ],
            ]

            expect(appendSignaturesSpy).to.have.been.callCount(rlpEncodedStrings.length)
            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(combined).to.equal(expectedRLPEncoded)
            checkFeePayerSignature(tx, { expectedSignatures })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-502: combineSignatures combines multiple signatures and feePayerSignatures', () => {
            let tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)

            // RLP encoding with only signatures
            const rlpEncodedStrings = [
                '0x4af901af018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef8d5f845820feaa01fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413a07e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44cf845820fe9a0d52efcc22cd8bc3ae0dc0fa8b4a0c68ffda9295ed7a9ed612d4af6bcdfc04af5a067749106fce239d6669ae86e9eb389f25e3c506e9934435150774ed2776e974cf845820feaa0ca90225e2de0caa34d9676690224028bd03cd99a76a0fa631466073a3f8f1944a02678afba3c5071e5a7a7084bcec0a12913f779a30303f81d897c862622048ab880c4c3018080',
            ]
            const expectedSignatures = [
                [
                    '0x0fea',
                    '0x1fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413',
                    '0x7e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c',
                ],
                [
                    '0x0fe9',
                    '0xd52efcc22cd8bc3ae0dc0fa8b4a0c68ffda9295ed7a9ed612d4af6bcdfc04af5',
                    '0x67749106fce239d6669ae86e9eb389f25e3c506e9934435150774ed2776e974c',
                ],
                [
                    '0x0fea',
                    '0xca90225e2de0caa34d9676690224028bd03cd99a76a0fa631466073a3f8f1944',
                    '0x2678afba3c5071e5a7a7084bcec0a12913f779a30303f81d897c862622048ab8',
                ],
            ]

            const appendSignaturesSpy = sandbox.spy(tx, 'appendSignatures')
            let combined = tx.combineSignatures(rlpEncodedStrings)
            expect(appendSignaturesSpy).to.have.been.callCount(rlpEncodedStrings.length)

            const rlpEncodedStringsWithFeePayerSignatures = [
                '0x4af901c3018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ec4c30180809475d141c9dbefde51f488c8d79da55f48282a1e52f8d5f845820feaa0945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3a0784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881f845820feaa092b2e701dea51bd0958d40d67b1a794822153a7624f35609d8f6320467067226a0161b871c857cf7ddb259e3dc76b4bad176a52b488bb9cea7198b778f3d0cb770f845820feaa0d67112e14b4fb00d5b0304638d665e0052e57e0d4bfa4fc00040b9e991bbd36da049eb2a9e8d2575e707631d2c3dc708152c5cbf59a52846871adbe7f8ae1add13',
            ]
            const expectedFeePayerSignatures = [
                [
                    '0x0fea',
                    '0x945863c17f8213765cb3196b6988840488e326055d0c654d34c71bd798ae5ec3',
                    '0x784a6ecf82352503d12bd2c609016b7e7f8af1ed04d0cdceb02cd0f0830d8881',
                ],
                [
                    '0x0fea',
                    '0x92b2e701dea51bd0958d40d67b1a794822153a7624f35609d8f6320467067226',
                    '0x161b871c857cf7ddb259e3dc76b4bad176a52b488bb9cea7198b778f3d0cb770',
                ],
                [
                    '0x0fea',
                    '0xd67112e14b4fb00d5b0304638d665e0052e57e0d4bfa4fc00040b9e991bbd36d',
                    '0x49eb2a9e8d2575e707631d2c3dc708152c5cbf59a52846871adbe7f8ae1add13',
                ],
            ]

            const appendFeePayerSignaturesSpy = sandbox.spy(tx, 'appendFeePayerSignatures')
            combined = tx.combineSignatures(rlpEncodedStrings)
            expect(appendFeePayerSignaturesSpy).to.have.been.callCount(rlpEncodedStringsWithFeePayerSignatures.length)

            // combine multiple signatures and feePayerSignatures
            tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)
            const combinedWithMultiple = tx.combineSignatures([combined])

            expect(combined).to.equal(combinedWithMultiple)
            checkSignature(tx, { expectedSignatures })
            checkFeePayerSignature(tx, { expectedFeePayerSignatures })
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-503: If decode transaction has different values, combineSignatures should throw error', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(transactionObj)
            tx.nonce = 1234

            const rlpEncoded =
                '0x4af90121018505d21dba00830249f094acfda1ac94468f2bda3e30a272215d0a5b5be413b8aff8ad80b8aaf8a8a00000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000002a00000000000000000000000000000000000000000000000000000000000000003a000000000000000000000000000000000000000000000000000000000000000040580061ef847f845820feaa01fba7ba78b13f7b85e8f240aea9ea22df8d0eaf68bc33486e815718e5a635413a07e1b339a04862531af1e966f2cddb2fe8dc6f48f508da435300045979d4ef44c80c4c3018080'
            const expectedError = `Transactions containing different information cannot be combined.`

            expect(() => tx.combineSignatures([rlpEncoded])).to.throw(expectedError)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getRawTransaction', () => {
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-504: getRawTransaction should call getRLPEncoding function', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const rawTransaction = tx.getRawTransaction()

            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(rawTransaction).to.equal(txWithExpectedValues.rlpEncoding)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getTransactionHash', () => {
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-505: getTransactionHash should call getRLPEncoding function and return hash of RLPEncoding', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')
            const txHash = tx.getTransactionHash()

            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(txHash).to.equal(txWithExpectedValues.transactionHash)
            expect(caver.utils.isValidHashStrict(txHash)).to.be.true
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-506: getTransactionHash should throw error when nonce is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._nonce

            const expectedError = `nonce is undefined. Define nonce in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getTransactionHash()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-507: getTransactionHash should throw error when gasPrice is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._gasPrice

            const expectedError = `gasPrice is undefined. Define gasPrice in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getTransactionHash()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-508: getTransactionHash should throw error when chainId is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._chainId

            const expectedError = `chainId is undefined. Define chainId in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getTransactionHash()).to.throw(expectedError)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getSenderTxHash', () => {
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-509: getSenderTxHash should call getRLPEncoding function and return hash of RLPEncoding', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            const getRLPEncodingSpy = sandbox.spy(tx, 'getRLPEncoding')

            const senderTxHash = tx.getSenderTxHash()

            expect(getRLPEncodingSpy).to.have.been.calledOnce
            expect(senderTxHash).to.equal(txWithExpectedValues.senderTxHash)
            expect(caver.utils.isValidHashStrict(senderTxHash)).to.be.true
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-510: getSenderTxHash should throw error when nonce is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._nonce

            const expectedError = `nonce is undefined. Define nonce in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getSenderTxHash()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-511: getSenderTxHash should throw error when gasPrice is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._gasPrice

            const expectedError = `gasPrice is undefined. Define gasPrice in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getSenderTxHash()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-512: getSenderTxHash should throw error when chainId is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._chainId

            const expectedError = `chainId is undefined. Define chainId in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getSenderTxHash()).to.throw(expectedError)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getRLPEncodingForSignature', () => {
        afterEach(() => {
            sandbox.restore()
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-513: getRLPEncodingForSignature should return RLP-encoded transaction string for signing', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)

            const commonRLPForSigningSpy = sandbox.spy(tx, 'getCommonRLPEncodingForSignature')

            const rlpEncodingForSign = tx.getRLPEncodingForSignature()

            expect(rlpEncodingForSign).to.equal(txWithExpectedValues.rlpEncodingForSigning)
            expect(commonRLPForSigningSpy).to.have.been.calledOnce
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-514: getRLPEncodingForSignature should throw error when nonce is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._nonce

            const expectedError = `nonce is undefined. Define nonce in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncodingForSignature()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-515: getRLPEncodingForSignature should throw error when gasPrice is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._gasPrice

            const expectedError = `gasPrice is undefined. Define gasPrice in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncodingForSignature()).to.throw(expectedError)
        })

        it('CAVERJS-UNIT-TRANSACTIONFD-516: getRLPEncodingForSignature should throw error when chainId is undefined', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._chainId

            const expectedError = `chainId is undefined. Define chainId in transaction or use 'transaction.fillTransaction' to fill values.`

            expect(() => tx.getRLPEncodingForSignature()).to.throw(expectedError)
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.getCommonRLPEncodingForSignature', () => {
        it('CAVERJS-UNIT-TRANSACTIONFD-517: getRLPEncodingForSignature should return RLP-encoded transaction string for signing', () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)

            const commonRLPForSign = tx.getCommonRLPEncodingForSignature()
            const decoded = RLP.decode(txWithExpectedValues.rlpEncodingForSigning)

            expect(commonRLPForSign).to.equal(decoded[0])
        })
    })

    context('feeDelegatedChainDataAnchoringWithRatio.fillTransaction', () => {
        it('CAVERJS-UNIT-TRANSACTIONFD-518: fillTransaction should call klay_getGasPrice to fill gasPrice when gasPrice is undefined', async () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._gasPrice

            await tx.fillTransaction()
            expect(getGasPriceSpy).to.have.been.calledOnce
            expect(getNonceSpy).not.to.have.been.calledOnce
            expect(getChainIdSpy).not.to.have.been.calledOnce
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-519: fillTransaction should call klay_getTransactionCount to fill nonce when nonce is undefined', async () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._nonce

            await tx.fillTransaction()
            expect(getGasPriceSpy).not.to.have.been.calledOnce
            expect(getNonceSpy).to.have.been.calledOnce
            expect(getChainIdSpy).not.to.have.been.calledOnce
        }).timeout(200000)

        it('CAVERJS-UNIT-TRANSACTIONFD-520: fillTransaction should call klay_getChainid to fill chainId when chainId is undefined', async () => {
            const tx = new caver.transaction.feeDelegatedChainDataAnchoringWithRatio(txWithExpectedValues.tx)
            delete tx._chainId

            await tx.fillTransaction()
            expect(getGasPriceSpy).not.to.have.been.calledOnce
            expect(getNonceSpy).not.to.have.been.calledOnce
            expect(getChainIdSpy).to.have.been.calledOnce
        }).timeout(200000)
    })
})
