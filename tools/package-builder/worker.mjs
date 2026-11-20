import {unzipSync, strFromU8} from 'fflate';
import {compilePackage} from './compiler.mjs';

let pendingSource;
self.onmessage = async ({data}) => {
  try {
    if (!pendingSource) pendingSource = (async () => {
      self.postMessage({type: 'progress', stage: 'downloading'});
      const catalogUrl = new URL('./catalog.json', self.location.href);
      const response = await fetch(catalogUrl, {cache: 'no-cache'});
      if (!response.ok) throw new Error('SOURCE_UNAVAILABLE');
      const catalog = await response.json();
      // Versioned filenames prevent mixing a cached catalog with a newer source.
      const archive = await fetch(new URL(catalog.archive, catalogUrl));
      if (!archive.ok) throw new Error('SOURCE_UNAVAILABLE');
      const source = unzipSync(new Uint8Array(await archive.arrayBuffer()));
      const embedded = JSON.parse(strFromU8(source['builder-catalog.json']));
      if (data.fingerprint !== embedded.fingerprint) throw new Error('VERSION_CHANGED');
      return {catalog: embedded, source};
    })();
    const {catalog, source} = await pendingSource;
    if (data.fingerprint !== catalog.fingerprint) throw new Error('VERSION_CHANGED');
    const compiled = compilePackage(catalog, source, data.selection,
      stage => self.postMessage({type: 'progress', stage}));
    self.postMessage({type: 'complete', bytes: compiled.bytes, summary: compiled.summary}, [compiled.bytes.buffer]);
  } catch (error) {
    pendingSource = undefined;
    self.postMessage({type: 'error', code: error.message});
  }
};
