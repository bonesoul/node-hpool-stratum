// 
//     hpool-stratum - stratum protocol module for hpool-server
//     Copyright (C) 2013 - 2014, hpool project 
//     http://www.hpool.org - https://github.com/int6/hpool-stratum
// 
//     This software is dual-licensed: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.
// 
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.
//    
//     For the terms of this license, see licenses/gpl_v3.txt.
// 
//     Alternatively, you can license this software under a commercial
//     license or white-label it as set out in licenses/commercial.txt.
//

exports.Rpc = {

    // Standard JSON-RPC 2.0 errors
    INVALID_REQUEST : -32600,
    METHOD_NOT_FOUND : -32601,
    INVALID_PARAMS : -32602,
    INTERNAL_ERROR : -32603,
    PARSE_ERROR : -32700,
    
    // General application defined errors
    MISC_ERROR : -1,  // std::exception thrown in command handling
    FORBIDDEN_BY_SAFE_MODE : -2,  // Server is in safe mode, and command is not allowed in safe mode
    TYPE_ERROR : -3,  // Unexpected type was passed as parameter
    INVALID_ADDRESS_OR_KEY : -5,  // Invalid address or key
    OUT_OF_MEMORY : -7,  // Ran out of memory during operation
    INVALID_PARAMETER : -8,  // Invalid, missing or duplicate parameter
    DATABASE_ERROR : -20, // Database error
    DESERIALIZATION_ERROR : -22, // Error parsing or validating structure in raw format
    TRANSACTION_ERROR : -25, // General error during transaction submission
    TRANSACTION_REJECTED : -26, // Transaction was rejected by network rules
    TRANSACTION_ALREADY_IN_CHAIN : -27, // Transaction already in chain
    
    // P2P client errors
    CLIENT_NOT_CONNECTED : -9,  // Bitcoin is not connected
    CLIENT_IN_INITIAL_DOWNLOAD : -10, // Still downloading initial blocks
    CLIENT_NODE_ALREADY_ADDED : -23, // Node is already added
    CLIENT_NODE_NOT_ADDED : -24, // Node has not been added before
    
    // Wallet errors
    WALLET_ERROR : -4,  // Unspecified problem with wallet (key not found etc.)
    WALLET_INSUFFICIENT_FUNDS : -6,  // Not enough funds in wallet or account
    WALLET_INVALID_ACCOUNT_NAME : -11, // Invalid account name
    WALLET_KEYPOOL_RAN_OUT : -12, // Keypool ran out, call keypoolrefill first
    WALLET_UNLOCK_NEEDED : -13, // Enter the wallet passphrase with walletpassphrase first
    WALLET_PASSPHRASE_INCORRECT : -14, // The wallet passphrase entered was incorrect
    WALLET_WRONG_ENC_STATE : -15, // Command given in wrong wallet encryption state (encrypting an encrypted wallet etc.)
    WALLET_ENCRYPTION_FAILED : -16, // Failed to encrypt the wallet
    WALLET_ALREADY_UNLOCKED : -17, // Wallet is already unlocked
}

exports.stratum = {
    METHOD_NOT_FOUND: [-3, "Method not found", null], 
    UNKNOWN: [20, "Other/Unknown error", null], 
    INCORRECT_SIZE_OF_NONCE: [20, "Incorrect size of nonce", null], 
    INCORRECT_SIZE_OF_EXTRANONCE2: [20, "Incorrect size of extranonce2", null], 
    INCORRECT_SIZE_OF_NTIME: [20, "Incorrect size of ntime", null], 
    NTIME_OUT_OF_RANGE: [20, "ntime out of range'", null], 
    JOB_NOT_FOUND: [21, "Job not found (=stale)", null],
    DUPLICATE_SHARE: [22, "Duplicate share", null],
    LOW_DIFFICULTY_SHARE: [23, "Low difficulty share", null],
    UNAUTHORIZED_WORKER: [24, "Unauthorized worker", null], 
    NOT_SUBSCRIBED: [24, "Not subscribed", null]
}