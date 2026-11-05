// Catálogo de la Tienda: solo cosméticos, sin marcas reales. Fotos en img/store/<id>_<color>.jpg
(function (root) {
  const PALETTE = { rojo: '#dc2626', azul: '#1d4ed8', verde: '#16a34a', dorado: '#d4a017', blanco: '#f8fafc', negro: '#111827',
    oro: '#d4af37', plata: '#c0c0c0', rosa: '#e7a3a8', esmeralda: '#10b981', zafiro: '#1e40af' };
  const NAMES = { rojo: 'Rojo', azul: 'Azul', verde: 'Verde', dorado: 'Dorado', blanco: 'Blanco', negro: 'Negro', oro: 'Oro', plata: 'Plata', rosa: 'Oro rosa', esmeralda: 'Esmeralda', zafiro: 'Zafiro' };
  const COLORS = ['rojo', 'azul', 'verde', 'dorado', 'blanco', 'negro'], J = ['oro', 'plata', 'rosa', 'negro', 'esmeralda', 'zafiro'];
  const CATS = [['carros', '🏎️ Carros'], ['motos', '🏍️ Motos'], ['barcos', '🛥️ Barcos'], ['aviones', '✈️ Aviones'], ['relojes', '⌚ Relojes'], ['casas', '🏠 Casas'], ['ropa', '👕 Ropa y accesorios']];
  const SUBS = [['arriba', 'Arriba'], ['abajo', 'Abajo'], ['zapatos', 'Zapatos'], ['medias', 'Medias'], ['cadenas', 'Cadenas'], ['joyas', 'Joyas'], ['accesorios', 'Accesorios']];
  const it = (id, cat, name, price, color, sub, colors = COLORS) => ({ id, cat, name, price, color, colors, ...(sub ? { sub } : {}) });
  const ITEMS = [
    it('car_deportivo', 'carros', 'Deportivo Rojo', 200000, 'rojo'), it('car_gt', 'carros', 'Gran Turismo Azul', 500000, 'azul'), it('car_super', 'carros', 'Superdeportivo L', 600000, 'dorado'), it('car_hiper', 'carros', 'Hiperauto Galáctico', 1000000, 'negro'),
    it('moto_scooter', 'motos', 'Scooter Playero', 20000, 'verde'), it('moto_naked', 'motos', 'Moto Callejera', 30000, 'rojo'), it('moto_pista', 'motos', 'Moto de Pista', 40000, 'verde'),
    it('jet_basico', 'barcos', 'Jet Ski Básico', 12000, 'azul'), it('jet_turbo', 'barcos', 'Jet Ski Turbo', 13500, 'rojo'), it('jet_pro', 'barcos', 'Jet Ski Pro', 15000, 'negro'),
    it('yate_lancha', 'barcos', 'Lancha Rápida', 700000, 'rojo'), it('yate_velero', 'barcos', 'Velero Clásico', 800000, 'azul'), it('yate_catamaran', 'barcos', 'Catamarán', 900000, 'blanco'), it('yate_blanco', 'barcos', 'Yate Blanco', 1000000, 'blanco'), it('yate_mega', 'barcos', 'Megayate Dorado', 1500000, 'dorado'),
    it('avion_avioneta', 'aviones', 'Avioneta', 400000, 'rojo'), it('avion_jet', 'aviones', 'Jet privado', 2000000, 'blanco'),
    it('reloj_plata', 'relojes', 'Reloj de Plata', 75000, 'blanco'), it('reloj_oro', 'relojes', 'Reloj de Oro', 350000, 'dorado'), it('reloj_diamante', 'relojes', 'Reloj de Diamantes', 1000000, 'azul'),
    it('casa_familiar', 'casas', 'Casa Familiar', 300000, 'azul'), it('casa_moderna', 'casas', 'Casa Moderna', 600000, 'blanco'), it('casa_playa', 'casas', 'Casa de Playa', 700000, 'dorado'), it('casa_residencia', 'casas', 'Residencia de Lujo', 1000000, 'negro'),
    it('casa_mansion', 'casas', 'Mansión en la Colina', 1400000, 'blanco'), it('casa_castillo', 'casas', 'Castillo Privado', 1900000, 'blanco'),
    it('top_camiseta', 'ropa', "Camiseta Premium", 8000, 'negro', 'arriba'),
    it('top_hoodie', 'ropa', "Hoodie", 15000, 'negro', 'arriba'),
    it('top_chaqueta', 'ropa', "Chaqueta de Cuero", 20000, 'negro', 'arriba'),
    it('top_abrigo', 'ropa', "Abrigo de Lujo", 25000, 'negro', 'arriba'),
    it('bot_jeans', 'ropa', "Jeans de Diseñador", 10000, 'negro', 'abajo'),
    it('bot_joggers', 'ropa', "Joggers", 12000, 'negro', 'abajo'),
    it('bot_cargo', 'ropa', "Pantalón Cargo", 18000, 'negro', 'abajo'),
    it('bot_vestir', 'ropa', "Pantalón de Vestir", 25000, 'negro', 'abajo'),
    it('zap_sport', 'ropa', "Zapatos Sport", 10000, 'negro', 'zapatos'),
    it('zap_casual', 'ropa', "Zapatos Casuales", 18000, 'negro', 'zapatos'),
    it('zap_vestir', 'ropa', "Zapatos de Vestir", 25000, 'negro', 'zapatos'),
    it('med_deportivas', 'ropa', "Medias Deportivas", 1000, 'negro', 'medias'),
    it('med_disenador', 'ropa', "Medias de Diseñador", 8000, 'negro', 'medias'),
    it('med_seda', 'ropa', "Medias de Seda", 15000, 'negro', 'medias'),
    it('cad_plata', 'ropa', "Cadena de Plata", 10000, 'oro', 'cadenas', J),
    it('cad_oro', 'ropa', "Cadena de Oro", 18000, 'oro', 'cadenas', J),
    it('cad_diamantes', 'ropa', "Cadena de Diamantes", 25000, 'oro', 'cadenas', J),
    it('joy_anillo', 'ropa', "Anillo de Oro", 12000, 'oro', 'joyas', J),
    it('joy_aretes', 'ropa', "Aretes de Diamante", 18000, 'oro', 'joyas', J),
    it('joy_pulsera', 'ropa', "Pulsera de Diamantes", 25000, 'oro', 'joyas', J),
    it('acc_gorra', 'ropa', "Gorra", 5000, 'negro', 'accesorios'),
    it('acc_lentes', 'ropa', "Lentes de Sol", 20000, 'negro', 'accesorios'),
    it('acc_cinturon', 'ropa', "Cinturón", 15000, 'negro', 'accesorios'),
    it('acc_mochila', 'ropa', "Mochila de Lujo", 25000, 'negro', 'accesorios')
  ];
  const byId = id => ITEMS.find(i => i.id === id);
  const valid = (id, c) => { const i = byId(id); return !!i && i.colors.includes(c); };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  // Normaliza colores antiguos (#rrggbb) al más cercano de la paleta del artículo; si no, el color base.
  const norm = (id, c) => { const i = byId(id); if (!i) return c; if (i.colors.includes(c)) return c;
    if (!/^#[0-9a-fA-F]{6}$/.test(c || '')) return i.color; const a = rgb(c);
    let best = i.color, bd = Infinity; for (const k of i.colors) { const b = rgb(PALETTE[k]), d = a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0); if (d < bd) { bd = d; best = k; } } return best; };
  const img = (id, c) => `img/store/${id}_${norm(id, c)}.jpg`;
  const render = (id, c) => { const i = byId(id); return i ? `<img loading="lazy" src="${img(id, c)}" alt="${i.name}">` : ''; };
  const api = { PALETTE, NAMES, COLORS, CATS, SUBS, ITEMS, byId, valid, norm, img, render };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Store = api;
})(this);
