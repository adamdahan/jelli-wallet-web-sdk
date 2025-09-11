// Juicebox configuration for web (real realms provided by user)

export const JUICEBOX_CONFIG = {
  realms: [
    {
      address: 'https://jelli-realm-1-e26248460bc4.herokuapp.com',
      id: '29237d86b521e338686006682ddc4531',
    },
    {
      address: 'https://jelli-realm-2-0d60fb8d3661.herokuapp.com',
      id: '4bb8c14640f1883a97d887a90a708beb',
    },
    {
      address: 'https://jelli-realm-3-4fb8ec753624.herokuapp.com',
      id: 'cf4b65d4c56872825da6155654423e98',
    },
  ],
  register_threshold: 2,
  recover_threshold: 2,
  pin_hashing_mode: 'Standard2019',
  backendUrl: 'https://jelli-juicebox-backend-dev-b0b281f49955.herokuapp.com',
};

export default JUICEBOX_CONFIG;

