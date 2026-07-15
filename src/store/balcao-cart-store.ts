"use client";

import { createCartStore } from "./cart-store";

/** Carrinho isolado da tela "Nova Venda" (admin) — não compartilha estado com o carrinho do site. */
export const useBalcaoCartStore = createCartStore("rl-balcao-cart");
