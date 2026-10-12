# Repor os áudios locais

O Museu usa exclusivamente os áudios do podcast e apresenta uma mensagem em caso de falha. Os 550 MP3 originais continuam na pasta EPISÓDIOS PARA O MUSEU do repositório, mas essa pasta foi excluída da publicação pelo ficheiro _config.yml.

Foi guardada uma cópia independente dos 550 ficheiros, dividida em cinco ZIP, em 12-10-2026. O conteúdo de todos os MP3 dentro dos ZIP foi verificado contra os identificadores dos ficheiros originais no Git.

Para repor a reprodução local:

1. Retirar EPISÓDIOS PARA O MUSEU da lista exclude em _config.yml.
2. Restaurar overlay.js a partir do ramo backup-antes-audios-rss-2026-10-12, commit 99b072c282f250cdecfa30bd9c0c921d137b215c.
3. Publicar ambas as alterações no mesmo commit e aguardar a conclusão do GitHub Pages.
4. Atualizar o navegador com Ctrl+F5 e verificar a reprodução.

A exclusão reduz o tamanho da página publicada; não elimina ficheiros nem reduz o histórico do repositório.
