import {
  encryptAndSplitSeed,
  reconstructAndDecryptMnemonic,
  reconstructAndDecryptSeed
} from '@iheartsolana/jelli-core';
import JuiceboxSdk, { PinHashingMode } from '@iheartsolana/jelli-juicebox-sdk';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import JelliCoreWalletService from '../JelliCoreWalletService';
import AuthService from './AuthService';
import { getFirebaseFirestore } from './FirebaseConfig';
import DeveloperPortalService from './DeveloperPortalService';
import { getUserPathComponents, getBackupPathComponents, getBackupCollectionPathComponents } from '../utils/firebasePaths';

/**
 * Onboarding Services - Redux-free service layer
 * 
 * Replaces RTK Query APIs with direct service calls for:
 * - Authentication (Google Sign-In)
 * - Wallet Creation
 * - Wallet Registration (Juicebox backup)
 * - Wallet Recovery (Juicebox + Firebase)
 */

import JelliConfig from '../JelliConfig';
import UserCacheService from './UserCacheService';

// Get Juicebox configuration from JelliConfig
const getJuiceboxConfig = () => {
  if (!JelliConfig.isReady()) {
    throw new Error('JelliConfig not initialized. Call JelliConfig.initialize() with your Juicebox config first.');
  }
  
  const config = JelliConfig.getJuiceboxConfig();
  
  return {
    realms: config.realms,
    register_threshold: config.register_threshold,
    recover_threshold: config.recover_threshold,
    pin_hashing_mode: config.pin_hashing_mode || PinHashingMode.Standard2019,
  };
};

const getBackendUrl = () => {
  if (!JelliConfig.isReady()) {
    throw new Error('JelliConfig not initialized. Call JelliConfig.initialize() with your Juicebox config first.');
  }
  
  return JelliConfig.getJuiceboxConfig().backendUrl;
};

const PIN_LENGTH = 4;
const ALLOWED_GUESSES = 5;

/**
 * Authentication Services
 */
export const authServices = {
  /**
   * Sign in with Google
   */
  signInWithGoogle: async () => {
    try {
      console.log('🔐 OnboardingServices: Starting Google sign-in...');
      
      const result = await AuthService.signInWithGoogle();
      
      if (!result.success || !result.user) {
        throw new Error(result.message || 'Google sign-in failed');
      }
      
      // Enrich Firebase user with profile fields from Web OAuth response
      const enrichedUser = {
        ...result.user,
        email: result.user.email || result.profile?.email || null,
        displayName: result.user.displayName || result.profile?.displayName || null,
        photoURL: result.user.photoURL || result.profile?.avatarUrl || null,
      };

      console.log('✅ OnboardingServices: Google sign-in successful for', enrichedUser.email);
      
      return {
        user: enrichedUser,
        token: result.token || null,
        success: true
      };
    } catch (error) {
      console.error('❌ OnboardingServices: Google sign-in failed:', error);
      throw error;
    }
  },

  /**
   * Get user document from Firestore
   */
  getUserDocument: async (userId) => {
    try {
      console.log('📄 OnboardingServices: Getting user document for', userId);
      
      const userDoc = await AuthService.getUserDocument(userId);
      
      console.log('✅ OnboardingServices: User document retrieved');
      
      return userDoc || {};
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to get user document:', error);
      throw error;
    }
  }
};

/**
 * Wallet Services
 */
export const walletServices = {
  /**
   * Create a new HD wallet using Phantom-compatible architecture (mnemonic → seed)
   */
  createWallet: async ({ name, strength = 128 }) => {
    try {
      console.log(`🌱 OnboardingServices: Creating HD wallet "${name}" with Phantom-compatible architecture (mnemonic → seed)`);
      
      // Generate BIP39 mnemonic for Phantom compatibility
      const { generateMnemonic } = await import('@scure/bip39');
      const { wordlist } = await import('@scure/bip39/wordlists/english');
      const { mnemonicToSeed } = await import('@scure/bip39');
      
      const mnemonic = generateMnemonic(wordlist, strength);
      console.log(`✅ OnboardingServices: Generated ${mnemonic.split(' ').length}-word mnemonic (${strength}-bit entropy)`);
      
      // Convert mnemonic to seed bytes (Phantom's derivation method)
      const seedUint8Array = await mnemonicToSeed(mnemonic, ''); // Empty passphrase like Phantom
      const seedBytes = Buffer.from(seedUint8Array);
      
      console.log(`✅ OnboardingServices: Derived ${seedBytes.length}-byte seed from mnemonic (Phantom compatible)`);
      
      // Create wallet from seed using JelliCoreWalletService (handles accounts creation)
      const result = await JelliCoreWalletService.createWalletFromSeed(name, seedBytes);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create wallet from seed');
      }
      
      console.log('✅ OnboardingServices: HD wallet created successfully with Phantom-compatible architecture');
      console.log('🔍 OnboardingServices: Wallet ID:', result.wallet?.id);
      
      // Report wallet creation to developer portal
      try {
        await DeveloperPortalService.reportWalletCreated({
          userId: result.wallet?.id,
          type: 'hd',
          networks: ['bitcoin', 'ethereum', 'solana', 'base'],
          name: name
        });
      } catch (error) {
        console.warn('⚠️ OnboardingServices: Failed to report wallet creation to portal:', error);
        // Don't fail wallet creation if portal reporting fails
      }
      
      return {
        ...result,
        seedBytes, // Include seed bytes for backup registration
        mnemonic,  // Include mnemonic for export capability
        exportable: true // Indicates Phantom compatibility
      };
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to create wallet:', error);
      throw error;
    }
  },

  /**
   * List all HD wallets
   */
  listWallets: async () => {
    try {
      console.log('📋 OnboardingServices: Listing all wallets...');
      
      const wallets = await JelliCoreWalletService.listWallets();
      
      console.log(`✅ OnboardingServices: Retrieved ${wallets.length} wallets`);
      
      return wallets;
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to list wallets:', error);
      throw error;
    }
  },

  /**
   * Get active wallet
   */
  getActiveWallet: async () => {
    try {
      console.log('🎯 OnboardingServices: Getting active wallet...');
      
      const wallet = await JelliCoreWalletService.getActiveWallet();
      
      console.log('✅ OnboardingServices: Active wallet retrieved');
      
      return wallet;
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to get active wallet:', error);
      throw error;
    }
  },

  /**
   * Get wallet mnemonic (for backward compatibility)
   */
  getWalletMnemonic: async (walletId) => {
    try {
      console.log('🔐 OnboardingServices: Getting wallet mnemonic for', walletId);
      
      const mnemonicResult = await JelliCoreWalletService.getWalletMnemonic(walletId);
      
      console.log('✅ OnboardingServices: Wallet mnemonic retrieved');
      
      return mnemonicResult;
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to get wallet mnemonic:', error);
      throw error;
    }
  }
};

/**
 * Juicebox Services
 */
export const juiceboxServices = {
  /**
   * Register wallet with Juicebox backup
   */
  registerWallet: async ({ seedBytes, mnemonic, pin, user, walletMetadata }) => {
    try {
      console.log('🔐 OnboardingServices: Starting wallet registration with Juicebox...');
      
      if (!seedBytes || !pin || !user || !walletMetadata) {
        throw new Error('Missing required parameters for wallet registration');
      }

      console.log('🔐 OnboardingServices: Using mnemonic for registration (Phantom compatibility)...');
      console.log('🔍 OnboardingServices: Mnemonic word count:', mnemonic.split(' ').length);
      
      // Step 2: Pad mnemonic to fixed length and shard it with Juicebox
      console.log('🔐 OnboardingServices: Padding mnemonic to fixed length for sharding...');
      
      // Pad mnemonic to 256 bytes (enough for 24-word mnemonic + padding)
      const mnemonicBuffer = Buffer.from(mnemonic, 'utf8');
      const paddedMnemonic = Buffer.alloc(256);
      mnemonicBuffer.copy(paddedMnemonic);
      console.log('🔍 OnboardingServices: Mnemonic padded to 256 bytes for consistent sharding');
      
      const result = await encryptAndSplitSeed(paddedMnemonic, {
        threshold: 2,
        totalShares: 2
      });
      
      if (!result?.keyShares || !result?.encrypted) {
        throw new Error('Failed to encrypt and split seed');
      }
      
      // Step 3: Get Juicebox authentication
      console.log('🔐 OnboardingServices: Getting Juicebox authentication...');
      // Robust email resolution: prefer passed user, then cached user
      let userEmail = user?.email || null;
      if (!userEmail) {
        try {
          const cached = await UserCacheService.getCurrentUser();
          userEmail = cached?.email || null;
        } catch (_) {}
      }
      if (!userEmail) {
        throw new Error('Missing email for Juicebox authentication');
      }
      const authentication = await getJuiceboxAuthentication(userEmail);
      
      // Step 4: Register key share with Juicebox
      console.log('🔐 OnboardingServices: Registering key share with Juicebox...');
      const juiceboxKeyShare = result.keyShares.shares[1];
      const encoder = new TextEncoder();
      const secretBytes = new Uint8Array(64);
      const shareBytes = new Uint8Array(juiceboxKeyShare);
      const copyLength = Math.min(shareBytes.length, 64);
      secretBytes.set(shareBytes.slice(0, copyLength));
      
      const juiceboxConfig = getJuiceboxConfig();
      await JuiceboxSdk.register(
        juiceboxConfig,
        authentication,
        encoder.encode(pin),
        secretBytes,
        encoder.encode('jelli_key_share'),
        ALLOWED_GUESSES
      );
      
      // Step 5: Store encrypted mnemonic + backend key share (API preferred)
      console.log('🔐 OnboardingServices: Storing backup data (API-preferred)...');
      const backupData = {
        encryptedMnemonic: {
          ciphertext: Array.from(result.encrypted.ciphertext),
          nonce: Array.from(result.encrypted.nonce),
          authTag: Array.from(result.encrypted.authTag),
          algorithm: result.encrypted.algorithm
        },
        backendKeyShare: Array.from(result.keyShares.shares[0]),
        juiceboxKeyShareLength: result.keyShares.shares[1].length,
        walletId: walletMetadata.id,
        createdAt: new Date().toISOString(),
        threshold: result.keyShares.threshold,
        totalShares: result.keyShares.totalShares,
        architecture: 'phantom-mnemonic-based'
      };
      

      
      // Try API first if enabled
      let backupStored = false;
      try {
        const useApi = JelliConfig.isApiEnabled('SDK_API_BACKUPS_PUT');
        if (useApi) {
          const { apiPutBackup } = await import('./ApiClient');
          const idem = `backup:${user.uid}:${walletMetadata.id}:put`;
          await apiPutBackup(user.uid, walletMetadata.id, backupData, { idempotencyKey: idem });
          backupStored = true;
          console.log('✅ OnboardingServices: Backup stored via API');
        }
      } catch (apiErr) {
        console.warn('⚠️ OnboardingServices: API backup PUT failed, falling back to Firestore:', apiErr?.message);
      }

      if (!backupStored) {
        const backupPathComponents = getBackupPathComponents(user.uid, walletMetadata.id);
        console.log('🔐 OnboardingServices: Writing backup to path:', backupPathComponents.join('/'));
        console.log('🔐 OnboardingServices: App ID from JWT:', JelliConfig.getAppInfo()?.id);
        await setDoc(doc(getFirebaseFirestore(), ...backupPathComponents), backupData);
        console.log('✅ OnboardingServices: Backup stored in Firestore');
      }
      
      // Step 6: Save wallet metadata to Firestore (no private keys!)
      console.log('🔐 OnboardingServices: Saving wallet metadata to Firestore...');
      const accounts = await JelliCoreWalletService.getAccountsForWallet(walletMetadata.id);
      
      console.log('🔍 OnboardingServices: Accounts result:', {
        success: accounts.success,
        accountCount: accounts.accounts?.length || 0,
        accounts: accounts.accounts?.map(acc => ({
          address: acc.address,
          chain: acc.chainType,
          accountIndex: acc.accountIndex
        })) || []
      });
      
      const walletData = {
        id: walletMetadata.id,
        name: walletMetadata.name || 'Jelli Wallet',
        type: 'HDWallet',
        strength: walletMetadata.strength || 128,
        createdAt: walletMetadata.createdAt || new Date().toISOString(),
        hasJuiceboxBackup: true,
        juiceboxBackupDate: new Date().toISOString(),
        accounts: accounts.success ? accounts.accounts.map(acc => ({
          id: acc.id || acc.address,
          address: acc.address,
          chain: acc.chainType || acc.chain,
          accountIndex: acc.accountIndex || 0,
          derivationPath: acc.derivationPath,
          createdAt: acc.createdAt || new Date().toISOString()
        })) : []
      };
      
      // Get existing wallets and merge the new one (de-duplicate by id)
      const existingWallets = await AuthService.getUserWallets();
      const wallets = existingWallets.success ? existingWallets.wallets : [];
      const existingIdx = wallets.findIndex(w => w && w.id === walletData.id);
      if (existingIdx >= 0) {
        wallets[existingIdx] = { ...wallets[existingIdx], ...walletData };
      } else {
        wallets.push(walletData);
      }
      
      // Create completely clean user document
      const cleanUserData = {
        uid: user.uid,
        email: user.email,
        provider: 'google',
        emailVerified: true,
        activeWalletId: walletMetadata.id,
        wallets: wallets,
        onboarding: {
          completed: true,
          steps: {
            setup: true,
            emailVerified: true,
            walletSetup: true
          }
        },
        profile: {
          displayName: user.displayName || null,
          avatar: user.photoURL || null,
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      console.log('🔍 OnboardingServices: Clean user data:', JSON.stringify(cleanUserData, null, 2));
      console.log('🔍 OnboardingServices: Wallet data being stored:', JSON.stringify(walletData, null, 2));
      
      // Step 8: Replace user doc (API preferred) with clean document
      let userReplaced = false;
      try {
        const useApi = JelliConfig.isApiEnabled('SDK_API_USER_PUT');
        if (useApi) {
          const { apiPutUser } = await import('./ApiClient');
          const idem = `user:${user.uid}:put-replace`;
          await apiPutUser(user.uid, cleanUserData, { idempotencyKey: idem });
          userReplaced = true;
          console.log('✅ OnboardingServices: User document replaced via API');
        }
      } catch (apiErr) {
        console.warn('⚠️ OnboardingServices: API user PUT failed, falling back to Firestore:', apiErr?.message);
      }

      if (!userReplaced) {
        // Use setDoc without merge to completely replace the document
        const userPathComponents = getUserPathComponents(user.uid);
        await setDoc(doc(getFirebaseFirestore(), ...userPathComponents), cleanUserData);
        console.log('✅ OnboardingServices: User document updated in Firebase with wallet data');
      }
      
      console.log('✅ OnboardingServices: Wallet registered with Juicebox successfully');
      
      return {
        success: true,
        walletId: walletMetadata.id,
        message: 'Wallet secured successfully with Juicebox backup'
      };
      
    } catch (error) {
      console.error('❌ OnboardingServices: Wallet registration failed:', error);
      throw error;
    }
  },

  /**
   * Recover wallet using Juicebox backup
   */
  recoverWallet: async ({ pin, user, walletId }) => {
    try {
      console.log('🔓 OnboardingServices: Starting wallet recovery with Juicebox...');
      
      if (!pin || !user) {
        throw new Error('Missing required parameters for wallet recovery');
      }

      // Step 1: Get encrypted seed + backend key share from Firebase
      console.log('🔐 OnboardingServices: Retrieving backup data from Firebase...');
      
      let backupDoc, backupData;
      
      if (walletId) {
        // Specific wallet recovery (when walletId is known)
        // Try API first if flag is enabled
        try {
          const useApi = JelliConfig.isApiEnabled('SDK_API_BACKUPS_GET');
          if (useApi) {
            const { apiGetBackup } = await import('./ApiClient');
            const apiResult = await apiGetBackup(user.uid, walletId);
            if (apiResult.exists) {
              console.log('🔐 OnboardingServices: Backup document loaded via API for walletId:', walletId);
              backupData = apiResult.data;
            } else {
              console.log('🔐 OnboardingServices: API indicates no backup for walletId:', walletId);
            }
          }
        } catch (apiErr) {
          console.warn('⚠️ OnboardingServices: API get backup failed, falling back to Firestore:', apiErr?.message);
        }

        if (!backupData) {
          const backupPathComponents = getBackupPathComponents(user.uid, walletId);
          console.log('🔐 OnboardingServices: Reading specific backup from path:', backupPathComponents.join('/'));
          console.log('🔐 OnboardingServices: App ID from JWT during specific recovery:', JelliConfig.getAppInfo()?.id);
          backupDoc = await getDoc(doc(getFirebaseFirestore(), ...backupPathComponents));
          if (!backupDoc.exists()) {
            throw new Error('No backup found for this wallet. Cannot recover.');
          }
          backupData = backupDoc.data();
        }
      } else {
        // General recovery - find the user's primary backup
        console.log('🔐 OnboardingServices: No walletId provided, looking for user\'s primary backup...');
        const backupCollectionComponents = getBackupCollectionPathComponents(user.uid);
        console.log('🔐 OnboardingServices: Reading backups from collection path:', backupCollectionComponents.join('/'));
        console.log('🔐 OnboardingServices: App ID from JWT during recovery:', JelliConfig.getAppInfo()?.id);
        const backupsCollection = collection(getFirebaseFirestore(), ...backupCollectionComponents);
        const backupsSnapshot = await getDocs(backupsCollection);
        
        if (backupsSnapshot.empty) {
          throw new Error('No backups found for this user. Cannot recover.');
        }
        
        // Get the first (and typically only) backup
        const firstBackupDoc = backupsSnapshot.docs[0];
        backupData = firstBackupDoc.data();
        walletId = firstBackupDoc.id; // Use the document ID as walletId
        

        console.log('✅ OnboardingServices: Found backup for walletId:', walletId);
      }
      
      console.log('✅ OnboardingServices: Backup data retrieved from Firebase');
      
      // Only support Phantom mnemonic-based architecture
      if (!backupData.encryptedMnemonic) {
        throw new Error('Only mnemonic-based backups are supported for Phantom compatibility.');
      }
      
      console.log('✅ OnboardingServices: Using Phantom mnemonic-based recovery');
      
      // Reconstruct encrypted mnemonic data object
      const encryptedData = {
        ciphertext: new Uint8Array(backupData.encryptedMnemonic.ciphertext),
        nonce: new Uint8Array(backupData.encryptedMnemonic.nonce),
        authTag: new Uint8Array(backupData.encryptedMnemonic.authTag),
        algorithm: backupData.encryptedMnemonic.algorithm
      };
      
      const backendKeyShare = new Uint8Array(backupData.backendKeyShare);
      
      console.log('🔍 OnboardingServices: Recovery data details:');
      console.log('  - Encrypted ciphertext length:', encryptedData.ciphertext.length, 'bytes');
      console.log('  - Encrypted nonce length:', encryptedData.nonce.length, 'bytes');
      console.log('  - Encrypted authTag length:', encryptedData.authTag.length, 'bytes');
      console.log('  - Backend key share size:', backendKeyShare.length, 'bytes');
      console.log('  - Stored threshold:', backupData.threshold, 'Total:', backupData.totalShares);
      console.log('  - Expected Juicebox share length:', backupData.juiceboxKeyShareLength, 'bytes');
      
      // Continue with recovery logic...
      return await juiceboxServices._completeRecovery({ pin, user, walletId, backupData, encryptedData, backendKeyShare });
      
    } catch (error) {
      console.error('❌ OnboardingServices: Wallet recovery failed:', error);
      throw error;
    }
  },

  /**
   * Complete the wallet recovery process (helper method)
   */
  _completeRecovery: async ({ pin, user, walletId, backupData, encryptedData, backendKeyShare }) => {
    // Step 2: Get authentication tokens
    console.log('🔐 OnboardingServices: Getting authentication tokens...');
    const authentication = await getJuiceboxAuthentication(user.email);
    
    // Step 3: Recover Juicebox key share (PIN-protected)
    console.log('🔐 OnboardingServices: Recovering key share from Juicebox...');
    const encoder = new TextEncoder();
    const juiceboxConfig = getJuiceboxConfig();
    const juiceboxRecoveredBytes = await JuiceboxSdk.recover(
      juiceboxConfig,
      authentication,
      encoder.encode(pin),
      encoder.encode('jelli_key_share')
    );
    
    // Extract the actual key share from the 64-byte padded data
    const expectedShareLength = backupData.juiceboxKeyShareLength || 33;
    const juiceboxKeyShare = juiceboxRecoveredBytes.slice(0, expectedShareLength);
    
    console.log('✅ OnboardingServices: Juicebox key share recovered');
    console.log('🔍 OnboardingServices: Juicebox key share size:', juiceboxKeyShare.length, 'bytes');
    
    // Step 4: Reconstruct encryption key and decrypt
    console.log('🔐 OnboardingServices: Reconstructing encryption key from 2-of-2 key shares...');
    
    const keyShares = [backendKeyShare, juiceboxKeyShare];
    
    // Step 5: Reconstruct and decrypt using Phantom mnemonic-based architecture
    console.log('🔐 OnboardingServices: Using Phantom mnemonic-based reconstruction...');
    const reconstructionResult = await reconstructAndDecryptSeed(
      encryptedData,
      keyShares,
      2 // threshold
    );
    
    if (!reconstructionResult || !reconstructionResult.success) {
      const errorMsg = reconstructionResult?.error || 'Unknown reconstruction error';
      throw new Error('Failed to reconstruct and decrypt mnemonic: ' + errorMsg);
    }
    
    const reconstructedMnemonicBuffer = reconstructionResult.seedBytes;
    // Remove padding by finding the null terminator
    const nullIndex = reconstructedMnemonicBuffer.indexOf(0);
    const mnemonicBuffer = nullIndex >= 0 ? reconstructedMnemonicBuffer.slice(0, nullIndex) : reconstructedMnemonicBuffer;
    const recoveredMnemonic = mnemonicBuffer.toString('utf8').trim();
    console.log('✅ OnboardingServices: Mnemonic reconstructed successfully (Phantom compatibility)');
    console.log('🔍 OnboardingServices: Recovered mnemonic word count:', recoveredMnemonic.split(' ').length);
    
    // Convert mnemonic to seed bytes for wallet creation
    const { mnemonicToSeed } = await import('@scure/bip39');
    const seedUint8Array = await mnemonicToSeed(recoveredMnemonic, ''); // Empty passphrase like Phantom
    const reconstructedSeedBytes = Buffer.from(seedUint8Array);
    
    console.log('🔑 OnboardingServices: Derived seed bytes from recovered mnemonic:', reconstructedSeedBytes.length, 'bytes');
    
    // Restore the recovered wallet using JelliCoreWalletService with original wallet ID
    console.log(`🔐 OnboardingServices: Restoring wallet with original ID: ${walletId}`);
    
    const importResult = await JelliCoreWalletService.restoreWalletFromSeed(walletId, 'Recovered Jelli Wallet', reconstructedSeedBytes);
    
    if (!importResult.success) {
      throw new Error('Failed to import recovered wallet: ' + importResult.message);
    }
    
    console.log('✅ OnboardingServices: Recovered wallet imported successfully');
    
    // Set the recovered wallet as active
    console.log(`🎯 OnboardingServices: Setting recovered wallet as active: ${walletId}`);
    await JelliCoreWalletService.setActiveWallet(walletId);
    
    // Store the recovered seed in memory for password encryption
    const WalletUtils = await import('../WalletUtils');
    WalletUtils.default._decryptedSeeds.set(walletId, reconstructedSeedBytes);
    WalletUtils.default._unlockTimestamps.set(walletId, Date.now());
    
    // Store the recovered mnemonic temporarily for password encryption during onboarding
    const secretVault = JelliCoreWalletService.secretVault;
    await secretVault.storeMnemonic(`recovered_mnemonic_${walletId}`, recoveredMnemonic);
    console.log('✅ OnboardingServices: Recovered mnemonic stored temporarily for password encryption');
    
    // Verify it's now active
    const activeWallet = await JelliCoreWalletService.getActiveWallet();
    console.log('🔍 OnboardingServices: Active wallet after recovery:', activeWallet?.id);
    
    if (activeWallet?.id !== walletId) {
      console.error('❌ OnboardingServices: Failed to set recovered wallet as active!');
    } else {
      console.log('✅ OnboardingServices: Recovered wallet is now active');
    }
    
    return {
      success: true,
      wallet: importResult.wallet,
      recoveryMethod: 'key_sharding',
      message: 'Wallet recovered and imported successfully'
    };
  },

  /**
   * Get user wallets and identify those with backup flags
   */
  _getUserWalletsWithBackupFlags: async (user) => {
    const db = getFirebaseFirestore();
    const { doc, getDoc } = await import('firebase/firestore');
    
    console.log('🔍 OnboardingServices: _getUserWalletsWithBackupFlags called for user:', user.uid);
    console.log('🔍 OnboardingServices: JelliConfig ready status:', JelliConfig.isReady());
    console.log('🔍 OnboardingServices: App info:', JelliConfig.getAppInfo());
    
    // Try API first if feature flag enabled, else fallback to Firestore
    let userData = null;
    try {
      const useApi = JelliConfig.isApiEnabled('SDK_API_USER_GET');
      if (useApi) {
        const { apiGetUser } = await import('./ApiClient');
        const apiResult = await apiGetUser(user.uid);
        if (apiResult.exists) {
          console.log('🔍 OnboardingServices: User document loaded via API for backup discovery');
          userData = apiResult.data;
        } else {
          console.log('🔍 OnboardingServices: API indicates no user document (backup discovery)');
        }
      }
    } catch (apiErr) {
      console.warn('⚠️ OnboardingServices: API user GET failed during discovery, falling back to Firestore:', apiErr?.message);
    }

    if (!userData) {
      const userPathComponents = getUserPathComponents(user.uid);
      console.log('🔍 OnboardingServices: Reading user document from path:', userPathComponents.join('/'));
      console.log('🔍 OnboardingServices: Full path components:', userPathComponents);
      console.log('🔍 OnboardingServices: App ID from JWT during backup discovery:', JelliConfig.getAppInfo()?.id);
      const userDocRef = doc(db, ...userPathComponents);
      console.log('🔍 OnboardingServices: Firebase doc reference created');
      const userDoc = await getDoc(userDocRef);
      console.log('🔍 OnboardingServices: Firebase doc fetch completed, exists:', userDoc.exists());
      if (!userDoc.exists()) {
        console.log('🔍 No user document found');
        return { userWallets: [], walletsWithBackups: [] };
      }
      userData = userDoc.data();
    }
    
    const userWallets = userData.wallets || [];
    const walletsWithBackups = userWallets.filter(wallet => wallet.hasJuiceboxBackup === true);
    
    console.log('🔍 User document found - wallets:', userWallets.length);
    console.log('🔍 Wallets with Juicebox backup flags:', walletsWithBackups.length);
    
    return { userWallets, walletsWithBackups };
  },

  /**
   * Get Firebase backup documents and correlate with user wallets
   */
  _getFirebaseBackupDocuments: async (user, userWallets) => {
    const db = getFirebaseFirestore();
    const { collection, getDocs } = await import('firebase/firestore');
    
    console.log('🔍 OnboardingServices: _getFirebaseBackupDocuments called');
    console.log('🔍 OnboardingServices: User wallets count:', userWallets.length);
    
    // Try API first if flag enabled
    try {
      const useApi = JelliConfig.isApiEnabled('SDK_API_BACKUPS_LIST');
      if (useApi) {
        const { apiListBackups } = await import('./ApiClient');
        const items = await apiListBackups(user.uid);
        const firebaseBackups = [];
        for (const item of items) {
          const correspondingWallet = userWallets.find(w => w.id === (item.id || item.walletId));
          const hasBackupFlag = correspondingWallet?.hasJuiceboxBackup === true;
          firebaseBackups.push({
            walletId: item.id || item.walletId,
            walletName: correspondingWallet?.name || 'Unknown Wallet',
            hasBackendShard: !!item.backendKeyShare,
            hasEncryptedData: !!item.encryptedMnemonic,
            hasBackupFlag,
            threshold: item.threshold || 2,
            totalShares: item.totalShares || 2,
            createdAt: item.createdAt,
            juiceboxBackupDate: correspondingWallet?.juiceboxBackupDate
          });
        }
        console.log('🔍 OnboardingServices: API backups found:', firebaseBackups.length);
        return firebaseBackups;
      }
    } catch (apiErr) {
      console.warn('⚠️ OnboardingServices: API list backups failed, falling back to Firestore:', apiErr?.message);
    }
    
    // Fallback to Firestore
    const backupCollectionComponents = getBackupCollectionPathComponents(user.uid);
    console.log('🔍 OnboardingServices: Backup collection path:', backupCollectionComponents.join('/'));
    console.log('🔍 OnboardingServices: Backup collection components:', backupCollectionComponents);
    
    const backupsCollectionRef = collection(db, ...backupCollectionComponents);
    console.log('🔍 OnboardingServices: Firebase collection reference created');
    
    const backupDocs = await getDocs(backupsCollectionRef);
    console.log('🔍 OnboardingServices: Firebase backup docs fetch completed, size:', backupDocs.size);
    
    const firebaseBackups = [];
    backupDocs.forEach(doc => {
      const data = doc.data();
      const correspondingWallet = userWallets.find(w => w.id === doc.id);
      const hasBackupFlag = correspondingWallet?.hasJuiceboxBackup === true;
      firebaseBackups.push({
        walletId: doc.id,
        walletName: correspondingWallet?.name || 'Unknown Wallet',
        hasBackendShard: !!data.backendKeyShare,
        hasEncryptedData: !!data.encryptedMnemonic,
        hasBackupFlag,
        threshold: data.threshold || 2,
        totalShares: data.totalShares || 2,
        createdAt: data.createdAt,
        juiceboxBackupDate: correspondingWallet?.juiceboxBackupDate
      });
    });
    
    console.log('🔍 Firebase backups found:', firebaseBackups.length);
    console.log('🔍 Firebase backups with user backup flags:', firebaseBackups.filter(b => b.hasBackupFlag).length);
    
    return firebaseBackups;
  },

  /**
   * Classify wallet backup status based on available data
   * All backups use mnemonic-based architecture
   */
  _classifyWalletBackupStatus: (backup) => {
    // Check if wallet has complete backup data
    if (backup.hasBackupFlag && backup.hasBackendShard && backup.hasEncryptedData) {
      console.log('✅ Wallet appears recoverable:', backup.walletId, `(${backup.walletName})`);
      return {
        ...backup,
        juiceboxStatus: 'appears_recoverable',
        requiresPin: true
      };
    }
    
    // If wallet has backup flag but missing Firebase data, it's incomplete
    if (backup.hasBackupFlag && (!backup.hasBackendShard || !backup.hasEncryptedData)) {
      console.log('⚠️ Wallet has backup flag but incomplete Firebase data:', backup.walletId, `(${backup.walletName})`);
      return {
        ...backup,
        juiceboxStatus: 'incomplete_backup',
        requiresPin: false
      };
    }
    
    // Default case - insufficient data for recovery
    console.log('❌ Wallet has insufficient backup data:', backup.walletId, `(${backup.walletName})`);
    return {
      ...backup,
      juiceboxStatus: 'insufficient_data',
      requiresPin: false
    };
  },

  /**
   * Classify all Firebase backups based on available data
   * No fake testing - just classification based on actual backup flags and data
   */
  _classifyFirebaseBackups: (firebaseBackups) => {
    const classifiedWallets = [];
    
    console.log('🔍 Classifying', firebaseBackups.length, 'Firebase backups based on available data');
    
    for (const backup of firebaseBackups) {
      const classifiedWallet = juiceboxServices._classifyWalletBackupStatus(backup);
      classifiedWallets.push(classifiedWallet);
    }
    
    return classifiedWallets;
  },

  /**
   * Determine the recommended action based on backup discovery results
   */
  _determineRecommendedAction: (firebaseBackups, classifiedWallets) => {
    const hasFirebaseBackups = firebaseBackups.length > 0;
    const hasRecoverableWallets = classifiedWallets.filter(w => 
      w.juiceboxStatus === 'appears_recoverable'
    ).length > 0;
    
    if (hasRecoverableWallets) return 'RECOVER';
    if (hasFirebaseBackups) return 'PARTIAL_RECOVERY';
    return 'CREATE_NEW';
  },

  /**
   * Comprehensive backup discovery - checks for existing Firebase + Juicebox backups
   * This should be called BEFORE creating any new wallets
   */
  discoverExistingBackups: async (user) => {
    try {
      console.log('🔍 OnboardingServices: Discovering existing backups for user:', user.email);
      console.log('🔍 OnboardingServices: JelliConfig.isReady():', JelliConfig.isReady());
      console.log('🔍 OnboardingServices: JelliConfig.getAppInfo():', JelliConfig.getAppInfo());
      
      // Check if JelliConfig is ready
      if (!JelliConfig.isReady()) {
        console.error('❌ OnboardingServices: JelliConfig not ready during backup discovery!');
        throw new Error('JelliConfig not initialized - cannot perform backup discovery');
      }
      
      const appId = JelliConfig.getAppInfo()?.id;
      if (!appId) {
        console.error('❌ OnboardingServices: No app ID available during backup discovery!');
        throw new Error('App ID not available - cannot perform backup discovery');
      }
      
      console.log('✅ OnboardingServices: App ID available for backup discovery:', appId);
      
      // Step 1: Get user wallets and identify those with backup flags
      const { userWallets, walletsWithBackups } = await juiceboxServices._getUserWalletsWithBackupFlags(user);
      
      // Step 2: Get Firebase backup documents and correlate with user wallets
      const firebaseBackups = await juiceboxServices._getFirebaseBackupDocuments(user, userWallets);
      
      // Step 3: Classify backups based on available data (no fake testing)
      const classifiedWallets = juiceboxServices._classifyFirebaseBackups(firebaseBackups);
      
      // Step 4: Determine overall backup status and recommended action
      const hasFirebaseBackups = firebaseBackups.length > 0;
      const hasWalletsWithBackupFlags = walletsWithBackups.length > 0;
      const hasRecoverableWallets = classifiedWallets.filter(w => 
        w.juiceboxStatus === 'appears_recoverable'
      ).length > 0;
      
      const recommendedAction = juiceboxServices._determineRecommendedAction(firebaseBackups, classifiedWallets);
      
      const result = {
        hasWalletsWithBackupFlags,
        hasFirebaseBackups,
        hasRecoverableWallets,
        firebaseBackups,
        recoverableWallets: classifiedWallets, // Use classified wallets instead
        userWallets,
        walletsWithBackups,
        recommendedAction
      };
      
      console.log('🔍 Backup discovery complete:', {
        hasWalletsWithBackupFlags,
        hasFirebaseBackups,
        hasRecoverableWallets,
        totalFirebaseBackups: firebaseBackups.length,
        totalWalletsWithBackupFlags: walletsWithBackups.length,
        totalRecoverableWallets: classifiedWallets.length,
        recommendedAction
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ OnboardingServices: Error discovering backups:', error);
      return {
        hasWalletsWithBackupFlags: false,
        hasFirebaseBackups: false,
        hasRecoverableWallets: false,
        firebaseBackups: [],
        recoverableWallets: [],
        userWallets: [],
        walletsWithBackups: [],
        recommendedAction: 'CREATE_NEW',
        error: error.message
      };
    }
  },

  /**
   * Check if user has Juicebox backup (legacy method - kept for compatibility)
   */
  checkBackupFlag: async (userId) => {
    try {
      console.log('🔍 OnboardingServices: Checking Juicebox backup flag for', userId);
      
      if (!userId) {
        return { hasBackup: false };
      }

      // Check Firebase for backup flag
      const backupDocRef = doc(getFirebaseFirestore(), 'backups', userId, 'flags', 'backup');
      const backupDoc = await getDoc(backupDocRef);
      
      const hasBackup = backupDoc.exists() && backupDoc.data()?.hasBackup === true;
      
      console.log('✅ OnboardingServices: Backup flag checked:', hasBackup);
      
      return { hasBackup };
      
    } catch (error) {
      console.error('❌ OnboardingServices: Failed to check backup flag:', error);
      // Default to false if we can't check
      return { hasBackup: false };
    }
  }
};

/**
 * Normalize email address for consistent Juicebox secret IDs
 * This ensures the same secret ID is used for register and recover operations
 * Must match the normalization logic in the mobile SDK and backend
 */
function normalizeEmailForSecretId(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email provided for normalization');
  }
  
  // Normalize: trim whitespace, convert to lowercase
  const normalized = email.trim().toLowerCase();
  
  if (!normalized) {
    throw new Error('Email cannot be empty after normalization');
  }
  
  return normalized;
}

/**
 * Get authentication tokens for Juicebox realms
 */
async function getJuiceboxAuthentication(email) {
  const authentication = {};
  const juiceboxConfig = getJuiceboxConfig();
  const backendUrl = getBackendUrl();
  
  // CRITICAL: Normalize email to ensure consistent secret IDs between register and recover
  const normalizedEmail = normalizeEmailForSecretId(email);
  console.log('🔐 OnboardingServices: Email normalization:', { original: email, normalized: normalizedEmail });
  
  for (const realm of juiceboxConfig.realms) {
    const requestBody = {
      realmId: realm.id,
      email: normalizedEmail, // Use normalized email for consistent secret ID
      source: 'google_auth',
      appName: 'Jelli Wallet'
    };
    
    const response = await fetch(`${backendUrl}/create-jwt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (response.status === 200) {
      const jwtToken = await response.text();
      authentication[realm.id] = jwtToken;
    } else {
      const errorText = await response.text();
      throw new Error(`JWT creation failed: ${response.status} - ${errorText}`);
    }
  }
  
  return authentication;
}

export default {
  auth: authServices,
  wallet: walletServices,
  juicebox: juiceboxServices
};
