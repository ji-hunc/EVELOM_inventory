import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getKoreanTime } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      category_id,
      description,
      image_url,
      code,
      cost_price,
      initial_stocks,
    } = await request.json();

    // 입력 유효성 검사
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "제품명은 필수입니다." },
        { status: 400 }
      );
    }

    if (!category_id) {
      return NextResponse.json(
        { error: "카테고리는 필수입니다." },
        { status: 400 }
      );
    }

    // 1. 제품 추가
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .insert({
        name: name.trim(),
        category_id,
        code: code?.trim() || null,
        description: description?.trim() || null,
        image_url: image_url || null,
        cost_price: cost_price || null,
        unit: "EA",
      })
      .select()
      .single();

    if (productError) {
      console.error("Product creation error:", productError);
      return NextResponse.json(
        { error: "제품 추가에 실패했습니다.", details: productError.message },
        { status: 500 }
      );
    }

    // 2. 위치별 초기 재고가 있는 경우만 인벤토리 생성
    const inventoryInserts: {
      location_id: string;
      product_id: string;
      batch_code: string;
      current_stock: number;
    }[] = [];

    if (initial_stocks && Array.isArray(initial_stocks)) {
      for (const stockInfo of initial_stocks) {
        const { location_id, batch_code, quantity } = stockInfo;

        if (quantity > 0 && location_id && batch_code) {
          inventoryInserts.push({
            product_id: product.name, // name을 FK로 사용
            location_id,
            batch_code,
            current_stock: quantity,
          });
        }
      }
    }

    // 인벤토리 항목이 있는 경우에만 삽입
    if (inventoryInserts.length > 0) {
      const { error: inventoryError } = await supabaseAdmin
        .from("inventory")
        .insert(inventoryInserts);

      if (inventoryError) {
        console.error("Inventory creation error:", inventoryError);
        return NextResponse.json(
          {
            error: "재고 설정에 실패했습니다.",
            details: inventoryError.message,
          },
          { status: 500 }
        );
      }

      // 3. 초기 재고에 대한 이동 기록 추가
      const movementInserts = inventoryInserts.map((item) => ({
        product_id: product.name,
        location_id: item.location_id,
        batch_code: item.batch_code,
        movement_type: "in" as const,
        quantity: item.current_stock,
        previous_stock: 0,
        new_stock: item.current_stock,
        movement_date: getKoreanTime().split("T")[0],
        notes: "신규 제품 등록 - 초기 재고",
        modifier: "system",
      }));

      const { error: movementError } = await supabaseAdmin
        .from("inventory_movements")
        .insert(movementInserts);

      if (movementError) {
        console.error("Movement creation error:", movementError);
      }
    }

    return NextResponse.json({
      success: true,
      product,
      message: "제품이 성공적으로 추가되었습니다.",
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select(
        `
        *,
        category:categories(*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Products fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch products" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: products || [],
    });
  } catch (error) {
    console.error("Products API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
