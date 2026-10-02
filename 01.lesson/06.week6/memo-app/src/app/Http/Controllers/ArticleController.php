<?php

namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function index(Request $request)
    {
        $q = $request->query('q');

        $articles = Article::query()
            ->when($q, fn ($query) => $query->where('title', 'like', "%{$q}%"))
            ->latest()
            ->get();

        $popular = Article::where('views', '>', 100)->get();

        return view('articles.index', compact('articles', 'popular'));
    }

    public function show(Article $article)
    {
        return view('articles.show', compact('article'));
    }

    public function create()
    {
        return view('articles.create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|max:20',
            'body'  => 'required|min:10',
        ]);

        $article = Article::create($validated);

        return redirect()->route('articles.show', $article->id)
            ->with('success', '記事を保存しました');
    }

    public function destroy(Article $article)
    {
        $title = $article->title;

        $article->delete();

        return redirect()->route('articles.index')
            ->with('success', "「{$title}」を削除しました");
    }
}