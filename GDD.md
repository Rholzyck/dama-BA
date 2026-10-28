# GDD — Jogo de Dama Clássico

## 1. Nome do projeto
Damas Master

## 2. Tipo de jogo
Jogo de tabuleiro digital de damas, desenvolvido para navegador.

## 3. Plataforma
- Navegador web
- Computador e dispositivos com suporte a toque

## 4. Objetivo
Capturar todas as peças do adversário ou deixar o adversário sem movimentos válidos.

## 5. Modos de jogo
- 2 Jogadores
- Vs Computador

## 6. Dificuldade da IA
- Fácil
- Médio
- Difícil

## 7. Regras implementadas
- Movimentação diagonal das peças.
- Captura obrigatória.
- Capturas múltiplas.
- Regra de maioria de capturas.
- Promoção para Dama.
- Movimento da Dama por várias casas na diagonal.
- Vitória por captura de todas as peças ou falta de movimentos válidos.

## 8. Sistemas do jogo
- Tabuleiro interativo em HTML Canvas.
- Seleção de peças e indicação de movimentos válidos.
- Contagem de peças capturadas.
- Cronômetro da partida.
- Botão de desfazer.
- Sons de movimento, captura, promoção e vitória.
- Efeitos visuais de partículas e ondas de impacto.
- Tela de vitória com confetes.
- Personagem 3D comemorando a vitória.

## 9. Estrutura do projeto

```text
meu-jogo/
├── index.html
├── style.css
├── script.js
├── GDD.md
└── assets/
    ├── imagens/
    ├── sons/
    └── fontes/
```

## 10. Tecnologias
- HTML5
- CSS3
- JavaScript
- HTML Canvas
- Tailwind CSS
- Font Awesome
- Tone.js
- Three.js

## 11. Como executar
Abra o arquivo `index.html` em um navegador moderno.

O jogo utiliza algumas bibliotecas externas por CDN. Portanto, para carregar todos os recursos externos normalmente, mantenha a conexão com a internet ativa.

## 12. Observação
O projeto foi organizado separando a apresentação visual (`style.css`) da lógica do jogo (`script.js`), mantendo o funcionamento do jogo em um único projeto.
