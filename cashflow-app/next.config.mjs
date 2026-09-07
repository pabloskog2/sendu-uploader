/** @type {import('next').NextConfig} */
const nextConfig = {
  // playwright-core (usado por SiiRcvClient) trae dependencias nativas/opcionales
  // que no se pueden empaquetar con webpack — debe cargarse como módulo de
  // Node normal en el runtime del servidor, no bundlearse.
  experimental: {
    serverComponentsExternalPackages: ["playwright-core"],
  },
};

export default nextConfig;
