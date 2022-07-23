pragma circom 2.0.3;

include "./helpers/tx_existence_check.circom";
include "./helpers/if_gadgets.circom";
include "./helpers/balance_leaf.circom";
include "./helpers/balance_existence_check.circom";
include "./helpers/get_merkle_root.circom";
include "../../../node_modules/circomlib/circuits/mux1.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";



// Sequencer State Update Proof
// Prove a tx root mutates one balance root to another balance root
template Main(balDepth, txDepth) {
    var numTxs = 2**txDepth;

    /// INPUTS ///

    // transaction inputs
    signal input from[numTxs][2]; // Sender EdDSA pubkey [x, y]
    signal input to[numTxs][2]; // Receiver EdDSA pubkey [x, y]
    signal input amount[numTxs];
    signal input fromIndex[numTxs]; // Sender index in balance tree
    signal input fromNonce[numTxs];
    signal input fromTokenType[numTxs];
    signal input signature[numTxs][3]; // EdDSA signature on tx leaf by Sender [R8x, R8y, S]

    // auxiliary state proving inputs
    signal input fromBalance[numTxs];
    signal input toNonce[numTxs];
    signal input toBalance[numTxs];
    signal input toTokenType[numTxs];

    // auxiliary merkle proof inputs
    signal input txPositions[numTxs][txDepth]; // path to tx leaf being checked for inclusion in tx tree
    signal input txProof[numTxs][balDepth]; // sibling nodes in tx tree proof
    signal input fromPositions[numTxs][balDepth]; // path to sender balance leaf being checked for inclusion
    signal input fromProof[numTxs][balDepth]; // sibling nodes in sender balance tree proof
    signal input toPositions[numTxs][balDepth]; // path to receiver balance leaf being checked for inclusion
    signal input fromProof[numTxs][balDepth]; // sibling nodes in receiver balance tree proof

    // public inputs
    signal input txRoot; // Transaction tree root
    signal input prevRoot; // Balance tree root before applying transaction root
    signal input nextRoot; // Balance tree root after applying transaction root

    /// COMPONENTS ///
    component ifBothHighForceEqual[numTxs]; // if values > 0 verifies equality
    component allLow[numTxs]; // check if all values are zero
    component burnMux[numTxs]; // multiplex to select whether or not to apply amount to balance or burn
    component isLessEqThan[numTxs]; // constrain one value to be <= to another
    component txExistence[numTxs]; // verifies tx existence in tx tree
    component senderExistence[numTxs]; // verifies sender existence in bal tree
    component receiverExistence[numTxs]; // verifies existence of receiver in bal tree
    component newSender[numTxs]; // compute balance leaf for sender after applying a tx
    component newReceiver[numTxs]; // compute balance leaf for receiver after applying a tx
    component computedRootFromNewSender[numTxs]; // computed bal tree root after applying sender state change
    component computedRootFromNewReceiver[numTxs]; // computed bal tree root after applying receiver state change

    /// LOGIC ///
    signal intermediateRoots[numTxs + 1];
    intermediateRoots[0] <== prevRoot;
    for (var i = 0; i < numTxs; i++) {
        // confirm tx existence in tx tree root
        txExistence[i] = TxExistence(txDepth);
        txExistence[i].from[0] <== from[i][0];
        txExistence[i].from[1] <== from[i][1];
        txExistence[i].fromIndex <== fromIndex[i];
        txExistence[i].to[0] <== to[i][0];
        txExistence[i].to[1] <== to[i][1];
        txExistence[i].nonce <== fromNonce[i];
        txExistence[i].amount <== amount[i];
        txExistence[i].tokenType <== fromTokenType[i];
        txExistence[i].root <== txRoot;
        for (var j = 0; j < txDepth; j++) {
            txExistence[i].positions[j] <== txPositions[i][j];
            txExistence[i].proof[j] <== txProof[i][j];
        }

        // confirm transaction leaf is signed by sender
        txExistence[i].signature[0] <== signature[i][0];
        txExistence[i].signature[1] <== signature[i][1];
        txExistence[i].signature[2] <== signature[i][2];

        // confirm existence of sender in balance tree
        senderExistence[i] = BalanceExistence();
        senderExistence[i].from[0] <== from[i][0];
        senderExistence[i].from[1] <== from[i][1];
        senderExistence[i].balance <== balanceFrom[i];
        senderExistence[i].nonce <== nonceFrom[i];
        senderExistence[i].tokenType <== tokenTypeFrom[i];
        senderExistence.balanceRoot <== intermediateRoots[i];
        for (var j = 0; j < balDepth; j++){
            senderExistence[i].positions[j] <== fromPositions[i][j];
            senderExistence[i].proof[j] <== fromProof[i][j];
        }

        // confirm sender has adaquate balance
        isLessEqThan[i] = LessEqThan(256);
        isLessEqThan[i].in[0] = balanceFrom[i];
        isLessEqThan[i].in[1] = amount[i];
        isLessEqThan[i].out === 1;

        // force non-withdrawal tx's to have consistent token types between sender and receiver
        ifBothHighForceEqual[i] = IfBothHighForceEqual();
        ifBothHighForceEqual[i].check1 <== to[i][0];
        ifBothHighForceEqual[i].check2 <== to[i][1];
        ifBothHighForceEqual[i].a <== tokenTypeTo[i];
        ifBothHighForceEqual[i].b <== tokenTypeFrom[i];

        // compute sender leaf post transaction
        newSender[i] = BalanceLeaf();
        newSender[i].pubkey[0] <== from[i][0];
        newSender[i].pubkey[1] <== from[i][1];
        newSender[i].balance <== balanceFrom[i] - amount[i];
        newSender[i].nonce <== nonceFrom[i] + 1;
        newSender[i].tokenType <== tokenTypeFrom[i];

        // get intra-tx intermediate root from new sender leaf
        computedRootFromNewSender[i] = GetMerkleRoot(balDepth);
        computedRootFromNewSender[i].leaf <== newSender[i].out;
        for (var j = 0; j < balDepth; j++){
            computedRootFromNewSender[i].proof[j] <== fromProof[i][j];
            computedRootFromNewSender[i].positions[j] <== fromPositions[i][j];
        }

        // confirm existence of receiver in balance tree
        receiverExistence[i] = BalanceExistence(balDepth);
        receiverExistence[i].pubkey[0] <== to[i][0];
        receiverExistence[i].pubkey[1] <== to[i][1];
        receiverExistence[i].balance <== balanceTo[i];
        receiverExistence[i].nonce <== nonceTo[i];
        receiverExistence[i].tokenType <== tokenTypeTo[i];
        receiverExistence[i].balanceRoot <==  computedRootFromNewSender[i].out;
        for (var j = 0; j < balDepth; j++){
            receiverExistence[i].positions[j] <== toPositions[i][j] ;
            receiverExistence[i].proof[j] <== toProof[i][j];
        }

        // handle whether or not transaction is to zero address
        allLow[i] = AllLow(2);
        allLow[i].in[0] <== to[i][0];
        allLow[i].in[1] <== to[i][1];
        burnMux[i] = Mux1();
        burnMux[i].c[0] <== balanceTo[i];
        burnMux[i].c[1] <== balanceTo[i] + amount[i];
        burnMux[i].s <== allLow[i].out;

        // compute receiver leaf post transaction
        newReceiver[i] = BalanceLeaf();
        newReceiver[i].pubkey[0] <== to[i][0];
        newReceiver[i].pubkey[1] <== to[i][1];
        newReceiver[i].balance <== burnMux[i].out; 
        newReceiver[i].nonce <== nonceTo[i];
        newReceiver[i].tokenType <== tokenTypeTo[i];

        // get balance tree root after applying transaction to both accounts
        computedRootFromNewReceiver[i] = GetMerkleRoot(balDepth);
        computedRootFromNewReceiver[i].leaf <== newReceiver[i].out;
        for (var j = 0; j < balDepth; j++){
            computedRootFromNewReceiver[i].proof[j] <== to[i][j];
            computedRootFromNewReceiver[i].positions[j] <== toPositions[i][j];
        }

        // assign inter-tx intermediate root variable
        intermediateRoots[i + 1] <== computedRootFromNewReceiver[i].out;
    }

    // confirm publicly reported next root is the same as computed root after applying all txs
    intermediateRoots[txDepth + 1] === nextRoot;
}

component main { public [root] } = Main(4, 2);
