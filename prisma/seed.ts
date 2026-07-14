import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify } from "../src/lib/format";

const prisma = new PrismaClient();

interface AddonSeed {
  name: string;
  priceCents: number;
}

interface ProductSeed {
  name: string;
  description: string;
  ingredients: string;
  priceCents: number;
  addons?: AddonSeed[];
}

interface CategorySeed {
  name: string;
  order: number;
  products: ProductSeed[];
}

// ---------------------------------------------------------------------------
// Cardápio real da Rute Lanches (encartes fornecidos pela cliente).
// Preços e recheios reproduzidos fielmente; adicionais de cada seção são
// aplicados a todos os produtos daquela seção, como nos encartes originais.
// ---------------------------------------------------------------------------

const LANCHE_ADDONS: AddonSeed[] = [
  { name: "Alface", priceCents: 300 },
  { name: "Milho", priceCents: 300 },
  { name: "Ervilha", priceCents: 300 },
  { name: "Batata palha", priceCents: 300 },
  { name: "Ovo", priceCents: 300 },
  { name: "Cheddar", priceCents: 400 },
  { name: "Catupiry", priceCents: 400 },
  { name: "Salsicha", priceCents: 400 },
  { name: "Presunto", priceCents: 400 },
  { name: "Mussarela (1 fatia)", priceCents: 400 },
  { name: "Hambúrguer", priceCents: 600 },
  { name: "Bacon", priceCents: 900 },
  { name: "Calabresa", priceCents: 900 },
  { name: "Frango desfiado", priceCents: 900 },
  { name: "Carne", priceCents: 900 },
];

const PASTEL_ADDONS: AddonSeed[] = [
  { name: "Mussarela", priceCents: 500 },
  { name: "Presunto", priceCents: 500 },
  { name: "Creme de avelã", priceCents: 500 },
  { name: "Doce de leite", priceCents: 500 },
  { name: "Banana", priceCents: 500 },
  { name: "Goiabada", priceCents: 500 },
  { name: "Cheddar", priceCents: 300 },
  { name: "Catupiry", priceCents: 300 },
  { name: "Azeitona", priceCents: 300 },
  { name: "Milho", priceCents: 300 },
  { name: "Ervilha", priceCents: 300 },
  { name: "Tomate", priceCents: 300 },
  { name: "Ovo", priceCents: 300 },
  { name: "Carne", priceCents: 700 },
  { name: "Calabresa", priceCents: 700 },
  { name: "Frango", priceCents: 700 },
  { name: "Bacon", priceCents: 700 },
];

const ACAI_ADDONS: AddonSeed[] = [
  { name: "Creme de avelã (camada dentro do açaí)", priceCents: 500 },
  { name: "Creme de avelã (saquinho)", priceCents: 500 },
  { name: "Leite condensado (saquinho)", priceCents: 250 },
  { name: "Confeti (saquinho)", priceCents: 300 },
  { name: "Paçoca (unidade)", priceCents: 100 },
];

const CATALOG: CategorySeed[] = [
  {
    name: "Lanches",
    order: 0,
    products: [
      {
        name: "Dog Simples",
        description: "Salsicha, calabresa, tomate e batata palha.",
        ingredients: "Salsicha, calabresa, tomate e batata palha",
        priceCents: 1700,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Dog Universitário",
        description: "Salsicha, calabresa, tomate e catupiry.",
        ingredients: "Salsicha, calabresa, tomate e catupiry",
        priceCents: 1700,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Dog Super Especial Pão Redondo",
        description: "Salsicha, bacon, calabresa, presunto, mussarela e mais.",
        ingredients:
          "Salsicha, bacon, calabresa, presunto, mussarela, tomate, milho, ervilha, batata palha e alface",
        priceCents: 2700,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Dog Mega Especial Pão Redondo",
        description: "2 salsichas, bacon, calabresa, presunto, mussarela, catupiry e cheddar.",
        ingredients:
          "2 salsichas, bacon, calabresa, presunto, mussarela, catupiry, cheddar, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Burguer",
        description: "Hambúrguer, tomate e mussarela.",
        ingredients: "Hambúrguer, tomate e mussarela",
        priceCents: 1800,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Salada Simples",
        description: "Hambúrguer, mussarela, tomate e alface.",
        ingredients: "Hambúrguer, mussarela, tomate e alface",
        priceCents: 2000,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Salada à Moda da Casa",
        description: "Hambúrguer, bacon, calabresa, mussarela e mais.",
        ingredients:
          "Hambúrguer, bacon, calabresa, mussarela, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Egg",
        description: "Hambúrguer, mussarela, ovo, tomate e alface.",
        ingredients: "Hambúrguer, mussarela, ovo, tomate e alface",
        priceCents: 2200,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Bacon",
        description: "Hambúrguer, bacon, mussarela, tomate e alface.",
        ingredients: "Hambúrguer, bacon, mussarela, tomate e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "X-Tudo",
        description: "Hambúrguer, bacon, calabresa, frango desfiado, catupiry e mais.",
        ingredients:
          "Hambúrguer, bacon, calabresa, frango desfiado, catupiry, presunto, cheddar, tomate, milho, ervilha, batata palha e alface",
        priceCents: 4000,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Calabresa",
        description: "Calabresa, bacon, mussarela, tomate e mais.",
        ingredients: "Calabresa, bacon, mussarela, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Frangão",
        description: "Frango desfiado, calabresa, mussarela e mais.",
        ingredients:
          "Frango desfiado, calabresa, mussarela, tomate, milho, ervilha, alface e batata palha",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Franburguer",
        description: "Frango desfiado, hambúrguer, catupiry e mais.",
        ingredients:
          "Frango desfiado, hambúrguer, catupiry, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Franbacon",
        description: "Frango desfiado, bacon, catupiry e mais.",
        ingredients:
          "Frango desfiado, bacon, catupiry, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Queijo Quente Simples",
        description: "4x mussarela, tomate, batata palha e alface.",
        ingredients: "4x mussarela, tomate, batata palha e alface",
        priceCents: 2300,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Queijo Quente Especial",
        description: "4x mussarela, calabresa, tomate e mais.",
        ingredients: "4x mussarela, calabresa, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Misto Quente Simples",
        description: "Presunto, mussarela, tomate, batata palha e alface.",
        ingredients: "Presunto, mussarela, tomate, batata palha e alface",
        priceCents: 2300,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Misto Quente Especial",
        description: "Presunto, mussarela, calabresa, tomate e mais.",
        ingredients: "Presunto, mussarela, calabresa, tomate, milho, ervilha, batata palha e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Americano",
        description: "3x presunto, 3x mussarela, 2 ovos, tomate e alface.",
        ingredients: "3x presunto, 3x mussarela, 2 ovos, tomate e alface",
        priceCents: 3100,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Churrasco Simples",
        description: "Bife picado, mussarela, tomate e alface.",
        ingredients: "Bife picado, mussarela, tomate e alface",
        priceCents: 3500,
        addons: LANCHE_ADDONS,
      },
      {
        name: "Churrasco Especial",
        description: "Bife picado, mussarela, bacon, calabresa e mais.",
        ingredients:
          "Bife picado, mussarela, bacon, calabresa, tomate, milho, ervilha, batata palha e alface",
        priceCents: 4000,
        addons: LANCHE_ADDONS,
      },
    ],
  },
  {
    name: "Pastéis",
    order: 1,
    products: [
      {
        name: "Carne",
        description: "Pastel de carne moída temperada.",
        ingredients: "Massa de pastel frita, carne moída temperada",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo",
        description: "Pastel de queijo.",
        ingredients: "Massa de pastel frita, queijo",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango",
        description: "Pastel de frango desfiado.",
        ingredients: "Massa de pastel frita, frango desfiado",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Calabresa",
        description: "Pastel de calabresa.",
        ingredients: "Massa de pastel frita, calabresa",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Bauru",
        description: "Presunto, queijo.",
        ingredients: "Massa de pastel frita, presunto, queijo",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Pizza",
        description: "Presunto, queijo, tomate, azeitona, orégano.",
        ingredients: "Massa de pastel frita, presunto, queijo, tomate, azeitona, orégano",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Portuguesa",
        description: "Presunto, queijo, ovo, tomate, milho, ervilha.",
        ingredients: "Massa de pastel frita, presunto, queijo, ovo, tomate, milho, ervilha",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Hot Dog",
        description: "Salsicha, calabresa, catupiry, tomate, batata palha.",
        ingredients: "Massa de pastel frita, salsicha, calabresa, catupiry, tomate, batata palha",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 1",
        description: "Carne, queijo.",
        ingredients: "Carne, queijo",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 2",
        description: "Carne, cheddar.",
        ingredients: "Carne, cheddar",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 3",
        description: "Carne, catupiry.",
        ingredients: "Carne, catupiry",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 4",
        description: "Carne, ovo.",
        ingredients: "Carne, ovo",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 5",
        description: "Carne, milho.",
        ingredients: "Carne, milho",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 6",
        description: "Carne, queijo, ovo.",
        ingredients: "Carne, queijo, ovo",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 7",
        description: "Carne, queijo, catupiry.",
        ingredients: "Carne, queijo, catupiry",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 8",
        description: "Carne, queijo, milho.",
        ingredients: "Carne, queijo, milho",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 9",
        description: "Carne, catupiry, ovo.",
        ingredients: "Carne, catupiry, ovo",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 10",
        description: "Carne, calabresa.",
        ingredients: "Carne, calabresa",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 11",
        description: "Carne, calabresa, queijo.",
        ingredients: "Carne, calabresa, queijo",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 12",
        description: "Carne, calabresa, catupiry.",
        ingredients: "Carne, calabresa, catupiry",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 13",
        description: "Carne, calabresa, cheddar.",
        ingredients: "Carne, calabresa, cheddar",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Carne 14",
        description: "Carne, ovo, queijo, azeitona.",
        ingredients: "Carne, ovo, queijo, azeitona",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo 1",
        description: "Queijo, milho.",
        ingredients: "Queijo, milho",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo 2",
        description: "Queijo, catupiry.",
        ingredients: "Queijo, catupiry",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo 3",
        description: "Queijo, cheddar.",
        ingredients: "Queijo, cheddar",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo 4",
        description: "Queijo, catupiry, cheddar.",
        ingredients: "Queijo, catupiry, cheddar",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Queijo 5",
        description: "Queijo, tomate, orégano.",
        ingredients: "Queijo, tomate, orégano",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 1",
        description: "Frango, milho.",
        ingredients: "Frango, milho",
        priceCents: 1350,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 2",
        description: "Frango, queijo.",
        ingredients: "Frango, queijo",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 3",
        description: "Frango, catupiry.",
        ingredients: "Frango, catupiry",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 4",
        description: "Frango, cheddar.",
        ingredients: "Frango, cheddar",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 5",
        description: "Frango, catupiry, milho.",
        ingredients: "Frango, catupiry, milho",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 6",
        description: "Frango, cheddar, milho.",
        ingredients: "Frango, cheddar, milho",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 7",
        description: "Frango, queijo, milho.",
        ingredients: "Frango, queijo, milho",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 8",
        description: "Frango, queijo, catupiry.",
        ingredients: "Frango, queijo, catupiry",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 9",
        description: "Frango, calabresa.",
        ingredients: "Frango, calabresa",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 10",
        description: "Frango, calabresa, queijo.",
        ingredients: "Frango, calabresa, queijo",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 11",
        description: "Frango, calabresa, catupiry.",
        ingredients: "Frango, calabresa, catupiry",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Frango 12",
        description: "Frango, calabresa, cheddar.",
        ingredients: "Frango, calabresa, cheddar",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Calabresa 1",
        description: "Calabresa, queijo.",
        ingredients: "Calabresa, queijo",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Calabresa 2",
        description: "Calabresa, catupiry.",
        ingredients: "Calabresa, catupiry",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Calabresa 3",
        description: "Calabresa, cheddar.",
        ingredients: "Calabresa, cheddar",
        priceCents: 1400,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Calabresa 4",
        description: "Calabresa, queijo, catupiry.",
        ingredients: "Calabresa, queijo, catupiry",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
    ],
  },
  {
    name: "Pastéis de Brócolis",
    order: 2,
    products: [
      {
        name: "Brócolis",
        description: "Pastel de brócolis.",
        ingredients: "Massa de pastel frita, brócolis",
        priceCents: 1200,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis e Queijo",
        description: "Brócolis, queijo.",
        ingredients: "Brócolis, queijo",
        priceCents: 1500,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Bacon e Queijo",
        description: "Brócolis, bacon, queijo.",
        ingredients: "Brócolis, bacon, queijo",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Frango e Catupiry",
        description: "Brócolis, frango, catupiry.",
        ingredients: "Brócolis, frango, catupiry",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Queijo e Milho",
        description: "Brócolis, queijo, milho.",
        ingredients: "Brócolis, queijo, milho",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Calabresa e Queijo",
        description: "Brócolis, calabresa, queijo.",
        ingredients: "Brócolis, calabresa, queijo",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Carne e Queijo",
        description: "Brócolis, carne, queijo.",
        ingredients: "Brócolis, carne, queijo",
        priceCents: 1600,
        addons: PASTEL_ADDONS,
      },
      {
        name: "Brócolis, Muçarela, Catupiry e Cheddar",
        description: "Brócolis, muçarela, catupiry, cheddar.",
        ingredients: "Brócolis, muçarela, catupiry, cheddar",
        priceCents: 1700,
        addons: PASTEL_ADDONS,
      },
    ],
  },
  {
    name: "Pastéis Doces",
    order: 3,
    products: [
      {
        name: "Ouro Branco ou Sonho de Valsa",
        description: "3 bombons, creme de avelã, regado no açúcar.",
        ingredients: "3 bombons (Ouro Branco ou Sonho de Valsa), creme de avelã, açúcar",
        priceCents: 1600,
      },
      {
        name: "Banana com Doce de Leite",
        description: "Banana, doce de leite, regado com açúcar e canela.",
        ingredients: "Banana, doce de leite, açúcar e canela",
        priceCents: 1600,
      },
      {
        name: "Romeu e Julieta",
        description: "Goiabada, queijo.",
        ingredients: "Goiabada, queijo",
        priceCents: 1600,
      },
      {
        name: "Morango com Creme de Avelã",
        description: "Morangos, creme de avelã.",
        ingredients: "Morangos, creme de avelã",
        priceCents: 1600,
      },
      {
        name: "Morango com Sulflair e Creme de Avelã",
        description: "Morangos, Sulflair, creme de avelã.",
        ingredients: "Morangos, chocolate Sulflair, creme de avelã",
        priceCents: 2200,
      },
    ],
  },
  {
    name: "Açaí",
    order: 4,
    products: [
      {
        name: "Açaí 350ml",
        description: "07 acompanhamentos inclusos.",
        ingredients: "Banana, morango, leite condensado, leite em pó, confeti, granola, amendoim",
        priceCents: 2000,
        addons: ACAI_ADDONS,
      },
      {
        name: "Açaí 500ml",
        description: "07 acompanhamentos inclusos.",
        ingredients: "Banana, morango, leite condensado, leite em pó, confeti, granola, amendoim",
        priceCents: 2500,
        addons: ACAI_ADDONS,
      },
      {
        name: "Açaí 750ml",
        description: "07 acompanhamentos inclusos.",
        ingredients: "Banana, morango, leite condensado, leite em pó, confeti, granola, amendoim",
        priceCents: 3200,
        addons: ACAI_ADDONS,
      },
      {
        name: "Açaí 1 Litro",
        description: "07 acompanhamentos inclusos.",
        ingredients: "Banana, morango, leite condensado, leite em pó, confeti, granola, amendoim",
        priceCents: 4500,
        addons: ACAI_ADDONS,
      },
      {
        name: "Açaí Barca",
        description: "07 acompanhamentos inclusos — para compartilhar.",
        ingredients: "Banana, morango, leite condensado, leite em pó, confeti, granola, amendoim",
        priceCents: 4500,
        addons: ACAI_ADDONS,
      },
      {
        name: "Açaí Roleta",
        description: "Escolha 05 acompanhamentos — leite condensado já incluso.",
        ingredients: "Leite condensado incluso + 5 acompanhamentos à escolha",
        priceCents: 4700,
        addons: ACAI_ADDONS,
      },
    ],
  },
  {
    name: "Fritas",
    order: 5,
    products: [
      {
        name: "Batata Frita Simples P",
        description: "Só batata.",
        ingredients: "Batata, sal",
        priceCents: 1500,
      },
      {
        name: "Batata Frita Simples G",
        description: "Só batata.",
        ingredients: "Batata, sal",
        priceCents: 2800,
      },
      {
        name: "Batata Frita Completa P",
        description: "Batata, bacon, calabresa e cheddar.",
        ingredients: "Batata, bacon, calabresa, cheddar",
        priceCents: 2300,
      },
      {
        name: "Batata Frita Completa G",
        description: "Batata, bacon, calabresa e cheddar.",
        ingredients: "Batata, bacon, calabresa, cheddar",
        priceCents: 3700,
      },
    ],
  },
  {
    name: "Bebidas",
    order: 6,
    products: [
      {
        name: "Coca-Cola 2L",
        description: "Garrafa 2 litros.",
        ingredients: "Refrigerante 2L",
        priceCents: 1600,
      },
      {
        name: "Fanta 2L",
        description: "Garrafa 2 litros.",
        ingredients: "Refrigerante 2L",
        priceCents: 1600,
      },
      {
        name: "Sprite 2L",
        description: "Garrafa 2 litros.",
        ingredients: "Refrigerante 2L",
        priceCents: 1600,
      },
      {
        name: "Vedete 2L",
        description: "Garrafa 2 litros.",
        ingredients: "Refrigerante 2L",
        priceCents: 900,
      },
      {
        name: "Coca-Cola 1,5L",
        description: "Garrafa 1,5 litro.",
        ingredients: "Refrigerante 1,5L",
        priceCents: 1300,
      },
      {
        name: "Fanta 1,5L",
        description: "Garrafa 1,5 litro.",
        ingredients: "Refrigerante 1,5L",
        priceCents: 1300,
      },
      {
        name: "Coca-Cola 600ml",
        description: "Garrafa 600ml.",
        ingredients: "Refrigerante 600ml",
        priceCents: 950,
      },
      {
        name: "Fanta 600ml",
        description: "Garrafa 600ml.",
        ingredients: "Refrigerante 600ml",
        priceCents: 950,
      },
      {
        name: "Sprite 600ml",
        description: "Garrafa 600ml.",
        ingredients: "Refrigerante 600ml",
        priceCents: 950,
      },
      {
        name: "Coca-Cola Lata",
        description: "Lata gelada.",
        ingredients: "Refrigerante lata",
        priceCents: 700,
      },
      {
        name: "Fanta Lata",
        description: "Lata gelada.",
        ingredients: "Refrigerante lata",
        priceCents: 700,
      },
      {
        name: "Sprite Lata",
        description: "Lata gelada.",
        ingredients: "Refrigerante lata",
        priceCents: 700,
      },
      {
        name: "Del Valle Lata",
        description: "Lata gelada.",
        ingredients: "Suco de fruta lata",
        priceCents: 800,
      },
      {
        name: "Del Valle Frut 1L",
        description: "Garrafa 1 litro.",
        ingredients: "Suco de fruta 1L",
        priceCents: 1000,
      },
      {
        name: "Água 500ml",
        description: "Sem gás.",
        ingredients: "Água mineral 500ml",
        priceCents: 350,
      },
      {
        name: "Água 1,5 Litro",
        description: "Sem gás.",
        ingredients: "Água mineral 1,5L",
        priceCents: 500,
      },
      {
        name: "Suco Natural de Laranja 500ml",
        description: "Feito na hora.",
        ingredients: "Laranja natural, 500ml",
        priceCents: 1500,
      },
      {
        name: "Suco de Polpas com Água",
        description: "Maracujá, morango, abacaxi, abacaxi com hortelã ou acerola — informe o sabor na observação.",
        ingredients: "Polpa de fruta batida com água",
        priceCents: 1200,
      },
      {
        name: "Suco de Polpas com Leite ou Laranja",
        description: "Maracujá, morango, abacaxi, abacaxi com hortelã ou acerola — informe o sabor na observação.",
        ingredients: "Polpa de fruta batida com leite ou laranja",
        priceCents: 1500,
      },
    ],
  },
];

async function seedCatalog() {
  // Ordem de deleção respeita as FKs (produtos/categorias sem pedidos ainda).
  await prisma.orderItemAddon.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.productAddon.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  for (const categorySeed of CATALOG) {
    const categorySlug = slugify(categorySeed.name);
    const category = await prisma.category.create({
      data: {
        name: categorySeed.name,
        slug: categorySlug,
        order: categorySeed.order,
      },
    });

    for (const [index, productSeed] of categorySeed.products.entries()) {
      await prisma.product.create({
        data: {
          categoryId: category.id,
          name: productSeed.name,
          // Prefixado pela categoria: vários produtos de categorias diferentes
          // têm o mesmo nome (ex: "Calabresa" em Lanches e em Pastéis).
          slug: `${categorySlug}-${slugify(productSeed.name)}`,
          description: productSeed.description,
          ingredients: productSeed.ingredients,
          priceCents: productSeed.priceCents,
          order: index,
          addons: productSeed.addons
            ? { create: productSeed.addons.map((a) => ({ name: a.name, priceCents: a.priceCents })) }
            : undefined,
        },
      });
    }
  }

  const totalProducts = CATALOG.reduce((sum, c) => sum + c.products.length, 0);
  console.log(`Catálogo criado: ${CATALOG.length} categorias, ${totalProducts} produtos.`);
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: "default" },
    // Contato oficial da empresa: sempre sincronizado, mesmo se a linha já existir
    // (demais campos como cores/logo ficam só no `create` — são customização do admin).
    update: {
      whatsapp: "(15) 99633-0266",
      address: "Rua Olga Charles Arruda, 12 - Jardim Josane, Sorocaba - SP",
    },
    create: {
      id: "default",
      storeName: "Rute Lanches",
      primaryColor: "#F97316",
      secondaryColor: "#16A34A",
      whatsapp: "(15) 99633-0266",
      address: "Rua Olga Charles Arruda, 12 - Jardim Josane, Sorocaba - SP",
      storeOpen: true,
      deliveryFeeCents: 500,
      minOrderCents: 1500,
      receiptWidth: "80mm",
    },
  });
  console.log("Configurações padrão da loja criadas.");
}

// Cadastro fiscal oficial da Rute Lanches (dados fornecidos pela cliente em
// 2026-07-14). Servem de emitente padrão para a NFC-e — quem quiser trocar,
// edita pela tela Admin → Fiscal.
async function seedFiscalConfig() {
  await prisma.fiscalConfig.upsert({
    where: { id: "default" },
    update: {
      cnpj: "31187807000109",
      razaoSocial: "Ruteneia Ferreira Melo",
      nomeFantasia: "Rute Lanches",
      inscricaoEstadual: "798.168.310.117",
      inscricaoMunicipal: "385.400",
      regimeTributario: "simples_nacional",
      email: "rutefmelo@yahoo.com.br",
      telefone: "(15) 99633-0266",
      cnaePrincipal: "5611-2/03",
      cnaeDescricao: "Lanchonetes, casas de chá, de sucos e similares",
      logradouro: "Rua Olga Charles Arruda",
      numero: "12",
      complemento: null,
      bairro: "Jardim Josane",
      municipioCodigo: "3552205",
      municipioNome: "Sorocaba",
      uf: "SP",
      cep: "18087300",
    },
    create: {
      id: "default",
      cnpj: "31187807000109",
      razaoSocial: "Ruteneia Ferreira Melo",
      nomeFantasia: "Rute Lanches",
      inscricaoEstadual: "798.168.310.117",
      inscricaoMunicipal: "385.400",
      regimeTributario: "simples_nacional",
      email: "rutefmelo@yahoo.com.br",
      telefone: "(15) 99633-0266",
      cnaePrincipal: "5611-2/03",
      cnaeDescricao: "Lanchonetes, casas de chá, de sucos e similares",
      logradouro: "Rua Olga Charles Arruda",
      numero: "12",
      bairro: "Jardim Josane",
      municipioCodigo: "3552205",
      municipioNome: "Sorocaba",
      uf: "SP",
      cep: "18087300",
    },
  });
  console.log("Cadastro fiscal (fiscal_config) atualizado com os dados oficiais da empresa.");
}

async function seedAdmin() {
  // Login simplificado (só senha) enquanto o sistema está em teste.
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@rutelanches.com.br";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "12345";

  if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "\n⚠️  SEED_ADMIN_EMAIL e/ou SEED_ADMIN_PASSWORD não definidas — usando valores de " +
        "teste (senha \"12345\"). Em produção, defina as duas no ambiente antes de rodar o seed.\n"
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      name: "Administrador",
      email,
      passwordHash,
      role: "owner",
    },
  });

  console.log("\n=== Login do admin (tela pede só a senha) ===");
  console.log(`Senha: ${password}`);
  console.log("================================================\n");
}

async function seedClienteRuteLanches() {
  const email = "rutefmelo@yahoo.com.br";
  const cliente = await prisma.cliente.upsert({
    where: { email },
    update: {
      empresaNome: "Rute Lanches", razaoSocial: "Ruteneia Ferreira Melo", cnpj: "31.187.807/0001-09",
      regimeTributario: "Simples Nacional", inscricaoEstadual: "798.168.310.117", inscricaoMunicipal: "385.400",
      telefone: "(15) 99633-0266", logradouro: "Rua Olga Charles Arruda", numero: "12", complemento: null,
      bairro: "Jardim Josane", cidade: "Sorocaba", uf: "SP", cep: "18087-300", codigoIbge: "3552205",
      cnaePrincipal: "5611-2/03", cnaeDescricao: "Lanchonetes, casas de chá, de sucos e similares", status: "ativo",
      plano: "Plano Essencial", statusAssinatura: "ativa",
    },
    create: {
      empresaNome: "Rute Lanches", razaoSocial: "Ruteneia Ferreira Melo", cnpj: "31.187.807/0001-09",
      regimeTributario: "Simples Nacional", inscricaoEstadual: "798.168.310.117", inscricaoMunicipal: "385.400", email, telefone: "(15) 99633-0266",
      logradouro: "Rua Olga Charles Arruda", numero: "12", bairro: "Jardim Josane", cidade: "Sorocaba", uf: "SP", cep: "18087-300", codigoIbge: "3552205",
      cnaePrincipal: "5611-2/03", cnaeDescricao: "Lanchonetes, casas de chá, de sucos e similares",
      status: "ativo", plano: "Plano Essencial", statusAssinatura: "ativa",
    },
  });
  await prisma.clienteUsuario.upsert({
    where: { email },
    update: { clienteId: cliente.id, nome: "Ruteneia Ferreira Melo", ativo: true },
    create: { clienteId: cliente.id, email, nome: "Ruteneia Ferreira Melo", passwordHash: await bcrypt.hash("Rute@2026", 12), deveAlterarSenha: true },
  });
  console.log("Cliente inicial Rute Lanches criado.");
}

async function main() {
  await seedSettings();
  await seedFiscalConfig();
  await seedAdmin();
  await seedClienteRuteLanches();
  await seedCatalog();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
