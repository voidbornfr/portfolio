import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    const saavnapi = require('saavnapi');
    const api = saavnapi.default || saavnapi;
    
    // First, search for songs
    const searchRes = await api.search.searchAll(query);
    
    if (!searchRes?.songs?.results || searchRes.songs.results.length === 0) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const firstSongId = searchRes.songs.results[0].id;
    
    // Then get song details (which includes streaming URLs)
    const songDetails = await api.songs.getSongByIds({ songIds: [firstSongId] });
    
    if (!songDetails || songDetails.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch song details' }, { status: 500 });
    }

    const song = songDetails[0];
    const streamUrls = song.downloadUrl;
    
    // Find the highest quality URL
    const highestQuality = streamUrls.find((url: any) => url.quality === '320kbps') 
      || streamUrls.find((url: any) => url.quality === '160kbps')
      || streamUrls[streamUrls.length - 1];

    return NextResponse.json({
      title: song.name,
      artist: song.artists.primary.map((a: any) => a.name).join(', '),
      image: song.image[song.image.length - 1]?.url,
      streamUrl: highestQuality.url
    });

  } catch (error: any) {
    console.error('Music API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
