const {FeeMarketEIP1559Transaction, Common} = require("web3-eth-accounts")
const erc20Abi = require("./abis/erc20.json");
const {Web3} = require("web3");
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})
const web3 = new Web3('https://rpc.ankr.com/eth_goerli');
const TOKEN_ADDR = '0x9C2747198728ceAE271f69f168E525A5c9A74AE3' || process.env.TOKEN_ADDR;
const MFA_ADDR = '0xce495f7de7f37c15d2955cd199eb8ef231aca710' || process.env.MFA_ADDR;
const TO_ADDR = '0x9C2747198728ceAE271f69f168E525A5c9A74AE3' || process.env.TO_ADDR;
const TRANSFER_AMNT = '1' || process.env.TRANSFER_AMNT;

async function signTx(transaction) {
    const serializedMessage = transaction.getMessageToSign(true);

    const signature = await new Promise((resolve, reject) => {
        rl.question(`Message: ${Buffer.from(serializedMessage).toString('base64')}\n`, async (signature) => {
            if (signature && signature.length === 132) {
                resolve(signature)
            } else {
                reject('invalid signature')
            }
        })
    });

    transaction = transaction._processSignature(
        BigInt('0x' + signature.slice(130, 132)) + 27n,
        web3.utils.bytesToUint8Array('0x' + signature.slice(2, 66)),
        web3.utils.bytesToUint8Array('0x' + signature.slice(66, 130))
    )

    return transaction.serialize();
}

const executeTransfer = async () => {
    const token = new web3.eth.Contract(erc20Abi, TOKEN_ADDR);
    const amount = web3.utils.toWei(TRANSFER_AMNT, "ether");
    const data = token.methods.transfer(TO_ADDR, amount).encodeABI();

    const block = await web3.eth.getBlock();
    const baseFee = Number(block.baseFeePerGas);
    const max = 10 + baseFee - 1;

    const txData = {
        from: MFA_ADDR,
        to: TOKEN_ADDR,
        value: '0x0',
        gasLimit: 100_000,
        data,
        nonce: await web3.eth.getTransactionCount(MFA_ADDR),
        chainId: await web3.eth.getChainId(),
        maxPriorityFeePerGas: baseFee,
        maxFeePerGas: max,
        type: 2,
    }

    console.log('creating tx...')
    let tx = FeeMarketEIP1559Transaction.fromTxData(txData, {common: Common.custom({}, {baseChain: "goerli"})});
    console.log('Upfront cost', tx.getUpfrontCost())
    const serializedTx = await signTx(tx);

    console.log('Sending transaction...');
    const res = await web3.eth.sendSignedTransaction(serializedTx);
    console.log('txhash', res.transactionHash)
}

executeTransfer()
    .catch(e => console.error(e))
    .finally(() => {
        rl.close();
    })