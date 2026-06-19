// Logo da marca Sellergy Cloud — usa o arquivo oficial em /logo-sellergy.png
// (servido estaticamente de frontend/public/). Esta logo e a marca da
// PLATAFORMA, fixa em todas as telas publicas e como default na sidebar.
//
// Cada tenant pode subir uma logo propria em Configuracoes → Aparencia →
// Identidade visual, que sobrepoe apenas na sidebar dele (vem de
// user.branding.logo, isolado por clienteId). Nao afeta o favicon nem
// outros tenants.
//
// Uso:
//   <SellergyLogo size={36} />

export default function SellergyLogo({ size = 32, className = '', alt = 'Sellergy Cloud' }) {
  return (
    <img
      src="/logo-sellergy.png"
      alt={alt}
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
