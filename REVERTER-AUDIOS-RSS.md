# Regressar aos áudios locais

Esta alteração utiliza os áudios alojados no podcast como primeira opção. Nenhum MP3 local foi apagado; continuam disponíveis como alternativa em caso de falha.

A versão anterior está preservada no ramo `backup-antes-audios-rss-2026-10-12`, no commit `99b072c282f250cdecfa30bd9c0c921d137b215c`. Para reverter apenas esta alteração, restaurar `overlay.js` a partir desse commit e publicar novamente o GitHub Pages.

Nesta fase de validação, o tamanho do site ainda não diminui, porque os áudios locais continuam incluídos. A exclusão dos MP3 da publicação deve ser feita apenas depois de validar as ligações e preparar uma cópia independente completa.
