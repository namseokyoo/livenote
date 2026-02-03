'use client';

import { useState, useCallback } from 'react';
import { CreateNoteForm } from '@/components/CreateNoteForm';
import { JoinNoteForm } from '@/components/JoinNoteForm';
import { NoteList } from '@/components/NoteList';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/Button';

type ActiveForm = 'none' | 'create' | 'join';

export default function Home() {
  const [activeForm, setActiveForm] = useState<ActiveForm>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleSearchingChange = useCallback((searching: boolean) => {
    setIsSearching(searching);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-16 max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-black mb-2">LiveNote</h1>
          <p className="text-gray-500">실시간 공유 노트</p>
        </div>

        {/* Main content */}
        {activeForm === 'none' && (
          <div className="flex flex-col gap-4">
            <Button
              variant="primary"
              onClick={() => setActiveForm('create')}
              className="w-full py-4 text-base"
            >
              노트 생성하기
            </Button>
            <Button
              variant="secondary"
              onClick={() => setActiveForm('join')}
              className="w-full py-4 text-base"
            >
              노트 참여하기
            </Button>
          </div>
        )}

        {activeForm === 'create' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">새 노트 생성</h2>
            <CreateNoteForm onCancel={() => setActiveForm('none')} />
          </div>
        )}

        {activeForm === 'join' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">노트 참여</h2>
            <JoinNoteForm onCancel={() => setActiveForm('none')} />
          </div>
        )}

        {/* Recent Notes Section */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {searchQuery ? '검색 결과' : '최근 노트'}
            </h2>
            <SearchBar onSearch={handleSearch} isSearching={isSearching} />
          </div>
          <NoteList search={searchQuery} onSearchingChange={handleSearchingChange} />
        </section>

        {/* Footer info */}
        <div className="mt-12 text-center text-sm text-gray-400">
          <p>호스트: 편집 가능 | 게스트: 읽기 전용</p>
        </div>
      </main>
    </div>
  );
}
