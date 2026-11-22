# Projeção

Sistema de projeção para igreja: letras, Bíblia, fundos em camadas (estilo Resolume), câmera da live, avisos, vídeos, PowerPoint com animações, TV de retorno com relógio/cronômetro e letra transparente para o OBS.

Roda no navegador (Google Chrome ou Microsoft Edge), sem instalar nada. É gratuito.

## Como usar no computador da igreja

1. Abra o **Google Chrome** e entre no endereço do sistema (GitHub Pages).
2. Vá em **⚙ Configurações → Telas**:
   - Clique em **Detectar telas** e aceite a permissão “gerenciar janelas”.
   - Escolha a tela de cada saída: **Telão**, **Projetores laterais** (saída do splitter) e **TV de retorno**.
   - Clique em **Abrir todas as saídas**. Se o Chrome bloquear pop-ups, permita para este site.
   - **Clique uma vez em cada tela** para ela entrar em tela cheia (duplo clique sai).
3. Em **Configurações → Câmera**, escolha a placa de captura HDMI→USB e clique em **Permitir / testar**.
   (Feche o OBS deste computador antes: no Windows a placa só pode ser usada por um programa por vez.)
4. No computador da live, no OBS: **Fontes → + → Navegador**, cole o endereço de **Configurações → Letra para a live**, com largura 1920 e altura 1080.

## Telas do sistema

- **Ao vivo**: músicas, Bíblia e arquivos à esquerda; cenas (pad), slides e camadas no centro; prévias das 4 saídas e a ordem do culto à direita.
- **Programação**: monta e salva as cenas. Para cada tela você escolhe fundo, sobreposição, letra (estilo, fonte, tamanho e posição) e câmera (posição, mesclagem, opacidade), arrastando as caixas.
- **Biblioteca**: importa imagens, vídeos, PowerPoint, músicas e Bíblias, e cria temas e sobreposições (cor, gradiente, imagem/vídeo em loop ou gerador ao vivo).
- **Retorno**: cronômetro, mensagem para o pregador e aparência da TV de retorno.
- **Configurações**: telas, câmera, live/OBS, backup e atalhos.

## Ordem das camadas

1. Tema (fundo base: sempre em loop)
2. Sobreposição (camada de ajuste com mesclagem)
3. Câmera da live
4. Letra / versículo
5. Mídia (imagem, vídeo, slide, PowerPoint): fica por cima de tudo. Ao tirar do ar, o que está embaixo continua.
6. Aviso

## TV de retorno

- **Música / Bíblia**: fundo preto, linha atual grande, começo da próxima linha, relógio e cronômetro (se ligado).
- **Imagem / vídeo / slide / PowerPoint**: a mídia em tela cheia com uma tarja em cima (relógio e cronômetro).

## PowerPoint com animações

1. Selecione o arquivo PPTX (aba Arquivos ou no culto) e clique em **Abrir no PowerPoint**. O arquivo abre direto em apresentação, numa janela, com animações.
   Dica: na primeira vez, no download do Chrome escolha “Sempre abrir arquivos deste tipo”.
2. Clique em **Capturar janela do PowerPoint** e escolha a janela. Ela vai para o telão, os laterais e a TV de retorno.
3. Clique na janela do PowerPoint: o passador passa a controlar a apresentação.

## Músicas do Holyrics

Exporte as músicas como **texto (.txt)** e importe em **Biblioteca → Músicas** (pode ser vários arquivos ou um .zip).
Formato: 1ª linha = título, 2ª = artista (opcional), linha em branco separa os slides, e `[Refrão]` numa linha sozinha nomeia o slide.

## Atalhos (teclado e passador)

| Tecla | Ação |
|---|---|
| → ↓ PageDown Espaço | próximo slide |
| ← ↑ PageUp | slide anterior |
| Esc | limpar letra |
| B ou . | tela preta |
| M | tirar mídia do ar |
| A | mostrar/esconder aviso |
| 1–9 | aplicar cena |

## Dados

Tudo fica salvo **no navegador deste computador**. Use **Configurações → Backup** para exportar e levar para outro computador.

## Desenvolvimento

```bash
npm install
npm run dev
npm run build
```
